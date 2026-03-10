import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Network, Share2, BookOpen, Presentation as Citation, Users, Info, Clock, GitBranch, Waypoints } from 'lucide-react';
import type { Publication } from '../types/scholar';
import { extractLastName } from '../utils/names';

interface Node {
  id: string;
  name: string;
  group: number;
  citations: number;
  sharedPublications: number;
  sharedCitations: number;
  clusterId?: number;
  betweenness?: number;
  firstYear?: number;
  lastYear?: number;
}

interface Link {
  source: string;
  target: string;
  valuePublications: number;
  valueCitations: number;
  firstYear?: number;
  lastYear?: number;
}

interface CitationNetworkProps {
  publications: Publication[];
  fullScreen?: boolean;
}

type ViewMode = 'publications' | 'citations' | 'temporal' | 'clusters';

// --- Graph algorithms ---

/**
 * Community detection via label propagation on the co-author subgraph.
 * Excludes the main author node (hub) from propagation so that clusters
 * reflect actual research communities among co-authors rather than
 * collapsing into one group through the hub.
 */
function detectClusters(nodes: Node[], links: Link[]): Map<string, number> {
  // Identify the main author (group === 1)
  const mainAuthorId = nodes.find(n => n.group === 1)?.id;

  const labels = new Map<string, number>();
  nodes.forEach((n, i) => labels.set(n.id, i));

  // Build adjacency excluding the main author hub
  const adjacency = new Map<string, string[]>();
  nodes.forEach(n => adjacency.set(n.id, []));
  links.forEach(l => {
    const src = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const tgt = typeof l.target === 'string' ? l.target : (l.target as any).id;
    // Skip edges to/from the main author for clustering purposes
    if (src === mainAuthorId || tgt === mainAuthorId) return;
    adjacency.get(src)?.push(tgt);
    adjacency.get(tgt)?.push(src);
  });

  // Only propagate labels among non-hub nodes
  const coAuthorNodes = nodes.filter(n => n.id !== mainAuthorId);

  for (let iter = 0; iter < 15; iter++) {
    let changed = false;
    const shuffled = [...coAuthorNodes].sort(() => Math.random() - 0.5);
    for (const node of shuffled) {
      const neighbors = adjacency.get(node.id) || [];
      if (neighbors.length === 0) continue;
      const freq = new Map<number, number>();
      for (const nb of neighbors) {
        const lbl = labels.get(nb)!;
        freq.set(lbl, (freq.get(lbl) || 0) + 1);
      }
      let maxFreq = 0;
      let bestLabel = labels.get(node.id)!;
      for (const [lbl, count] of freq) {
        if (count > maxFreq) {
          maxFreq = count;
          bestLabel = lbl;
        }
      }
      if (bestLabel !== labels.get(node.id)) {
        labels.set(node.id, bestLabel);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Normalize cluster IDs to 0, 1, 2, ...
  // Main author gets its own cluster ID (0)
  const coAuthorLabels = [...new Set(
    coAuthorNodes.map(n => labels.get(n.id)!)
  )];
  const labelMap = new Map<number, number>();
  coAuthorLabels.forEach((lbl, i) => labelMap.set(lbl, i + 1)); // 1-indexed for co-authors

  const normalized = new Map<string, number>();
  if (mainAuthorId) normalized.set(mainAuthorId, 0);
  coAuthorNodes.forEach(n => {
    const lbl = labels.get(n.id)!;
    normalized.set(n.id, labelMap.get(lbl) ?? 0);
  });
  return normalized;
}

/** Approximate betweenness centrality using BFS from all nodes */
function computeBetweenness(nodes: Node[], links: Link[]): Map<string, number> {
  const scores = new Map<string, number>();
  nodes.forEach(n => scores.set(n.id, 0));

  const adjacency = new Map<string, string[]>();
  nodes.forEach(n => adjacency.set(n.id, []));
  links.forEach(l => {
    const src = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const tgt = typeof l.target === 'string' ? l.target : (l.target as any).id;
    adjacency.get(src)?.push(tgt);
    adjacency.get(tgt)?.push(src);
  });

  for (const source of nodes) {
    // BFS
    const dist = new Map<string, number>();
    const paths = new Map<string, number>();
    const pred = new Map<string, string[]>();
    const stack: string[] = [];

    dist.set(source.id, 0);
    paths.set(source.id, 1);
    const queue = [source.id];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      const d = dist.get(v)!;
      for (const w of (adjacency.get(v) || [])) {
        if (!dist.has(w)) {
          dist.set(w, d + 1);
          queue.push(w);
        }
        if (dist.get(w) === d + 1) {
          paths.set(w, (paths.get(w) || 0) + (paths.get(v) || 1));
          if (!pred.has(w)) pred.set(w, []);
          pred.get(w)!.push(v);
        }
      }
    }

    // Back-propagation
    const delta = new Map<string, number>();
    nodes.forEach(n => delta.set(n.id, 0));

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of (pred.get(w) || [])) {
        const d = (delta.get(v) || 0) + ((paths.get(v) || 1) / (paths.get(w) || 1)) * (1 + (delta.get(w) || 0));
        delta.set(v, d);
      }
      if (w !== source.id) {
        scores.set(w, (scores.get(w) || 0) + (delta.get(w) || 0));
      }
    }
  }

  // Normalize by dividing by 2 (undirected) and by max
  const maxScore = Math.max(...scores.values(), 1);
  scores.forEach((val, key) => scores.set(key, val / (2 * maxScore)));

  return scores;
}

// Bridge author betweenness threshold (top ~20% of nodes)
const BRIDGE_THRESHOLD = 0.15;

// Cluster colors (vibrant, distinct, accessible palette)
const CLUSTER_COLORS = [
  '#0d9488', '#e07a5f', '#7c3aed', '#059669', '#db2777',
  '#2563eb', '#d97706', '#6366f1', '#dc2626', '#0891b2'
];

export function CitationNetwork({ publications, fullScreen = false }: CitationNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('publications');
  const [connectionLimit, setConnectionLimit] = useState<10 | 20>(10);

  const stopSimulation = () => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
  };

  const handleViewMode = (mode: ViewMode) => {
    stopSimulation();
    setViewMode(mode);
  };

  const handleConnectionLimit = (limit: 10 | 20) => {
    stopSimulation();
    setConnectionLimit(limit);
  };

  useEffect(() => {
    if (!svgRef.current || !publications.length) return;

    d3.select(svgRef.current).selectAll('*').remove();
    stopSimulation();

    const showCitations = viewMode === 'citations';

    // Find the main author
    const authorFrequency = new Map<string, number>();
    publications.forEach(pub => {
      pub.authors.forEach(author => {
        authorFrequency.set(author, (authorFrequency.get(author) || 0) + 1);
      });
    });
    const sortedAuthors = Array.from(authorFrequency.entries())
      .sort((a, b) => b[1] - a[1]);
    if (sortedAuthors.length === 0) return;
    const mainAuthor = sortedAuthors[0][0];

    // Process data - track years for temporal feature
    const nodes: Node[] = [];
    const links: Link[] = [];
    const authorMap = new Map<string, {
      publications: Set<string>,
      citations: number,
      papers: Set<string>,
      years: number[],
      coAuthors: Map<string, { papers: Set<string>, citations: number, years: number[] }>
    }>();

    // Main author node
    const mainYears = publications.map(p => p.year).filter(y => y > 0);
    nodes.push({
      id: mainAuthor,
      name: mainAuthor,
      group: 1,
      citations: publications.reduce((sum, pub) => sum + pub.citations, 0),
      sharedPublications: publications.length,
      sharedCitations: publications.reduce((sum, pub) => sum + pub.citations, 0),
      firstYear: Math.min(...mainYears),
      lastYear: Math.max(...mainYears)
    });

    // Process co-authors
    publications.forEach(pub => {
      const coAuthors = pub.authors.filter(author => author !== mainAuthor);

      coAuthors.forEach(author => {
        if (!authorMap.has(author)) {
          authorMap.set(author, {
            publications: new Set(),
            citations: 0,
            papers: new Set(),
            years: [],
            coAuthors: new Map()
          });
        }
        const authorData = authorMap.get(author)!;
        authorData.publications.add(pub.title);
        authorData.citations += pub.citations;
        authorData.papers.add(pub.title);
        if (pub.year > 0) authorData.years.push(pub.year);

        coAuthors.forEach(coAuthor => {
          if (author !== coAuthor) {
            if (!authorData.coAuthors.has(coAuthor)) {
              authorData.coAuthors.set(coAuthor, {
                papers: new Set(),
                citations: 0,
                years: []
              });
            }
            const coAuthorData = authorData.coAuthors.get(coAuthor)!;
            coAuthorData.papers.add(pub.title);
            coAuthorData.citations += pub.citations;
            if (pub.year > 0) coAuthorData.years.push(pub.year);
          }
        });
      });
    });

    // Sort and filter
    const sortedByStrength = Array.from(authorMap.entries()).sort((a, b) => {
      const valueA = showCitations ? a[1].citations : a[1].publications.size;
      const valueB = showCitations ? b[1].citations : b[1].publications.size;
      return valueB - valueA;
    });
    const filteredAuthors = sortedByStrength.slice(0, connectionLimit);

    const addedAuthors = new Set<string>([mainAuthor]);

    filteredAuthors.forEach(([author, data]) => {
      const years = data.years;
      nodes.push({
        id: author,
        name: author,
        group: 2,
        citations: data.citations,
        sharedPublications: data.publications.size,
        sharedCitations: data.citations,
        firstYear: years.length > 0 ? Math.min(...years) : undefined,
        lastYear: years.length > 0 ? Math.max(...years) : undefined
      });
      addedAuthors.add(author);

      links.push({
        source: mainAuthor,
        target: author,
        valuePublications: data.publications.size,
        valueCitations: data.citations,
        firstYear: years.length > 0 ? Math.min(...years) : undefined,
        lastYear: years.length > 0 ? Math.max(...years) : undefined
      });

      data.coAuthors.forEach((coAuthorData, coAuthor) => {
        if (addedAuthors.has(coAuthor)) {
          const coYears = coAuthorData.years;
          links.push({
            source: author,
            target: coAuthor,
            valuePublications: coAuthorData.papers.size,
            valueCitations: coAuthorData.citations,
            firstYear: coYears.length > 0 ? Math.min(...coYears) : undefined,
            lastYear: coYears.length > 0 ? Math.max(...coYears) : undefined
          });
        }
      });
    });

    // --- Compute clusters ---
    const clusterMap = detectClusters(nodes, links);
    nodes.forEach(n => { n.clusterId = clusterMap.get(n.id) ?? 0; });

    // --- Compute betweenness centrality ---
    const betweennessMap = computeBetweenness(nodes, links);
    nodes.forEach(n => { n.betweenness = betweennessMap.get(n.id) ?? 0; });

    // --- Temporal color scale ---
    const allYears = links.map(l => l.lastYear).filter((y): y is number => y != null);
    const minYear = allYears.length > 0 ? Math.min(...allYears) : 2000;
    const maxYear = allYears.length > 0 ? Math.max(...allYears) : 2024;
    const temporalColorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([minYear, maxYear]);

    // --- Set up visualization ---
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', [0, 0, width, height]);

    const defs = svg.append('defs');

    // Default link gradient
    const gradient = defs.append('linearGradient')
      .attr('id', 'link-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#2d7d7d');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#64748b');

    // Bridge author glow filter
    const filter = defs.append('filter')
      .attr('id', 'bridge-glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    filter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .join('feMergeNode')
      .attr('in', d => d);

    // Color scale for collaboration strength (used in non-cluster views)
    const maxPubs = Math.max(...nodes.filter(n => n.group !== 1).map(n => n.sharedPublications), 1);
    const maxCites = Math.max(...nodes.filter(n => n.group !== 1).map(n => n.sharedCitations), 1);
    const strengthColorScale = d3.scaleSequential(d3.interpolateViridis)
      .domain([0, showCitations ? maxCites : maxPubs]);

    // Node color based on view mode
    function getNodeColor(d: Node): string {
      if (d.group === 1) return '#0d9488'; // main author teal
      if (viewMode === 'clusters') {
        return CLUSTER_COLORS[(d.clusterId ?? 0) % CLUSTER_COLORS.length];
      }
      if (viewMode === 'temporal') {
        // Color by recency of collaboration
        if (d.lastYear) return temporalColorScale(d.lastYear);
        return '#94a3b8';
      }
      // Publications/Citations view: color by collaboration strength
      const value = showCitations ? d.sharedCitations : d.sharedPublications;
      return strengthColorScale(value);
    }

    // Node stroke for bridge authors — shown in all views
    function getNodeStroke(d: Node): string {
      if (d.group !== 1 && (d.betweenness ?? 0) > BRIDGE_THRESHOLD) {
        return '#f59e0b'; // amber highlight for bridge authors
      }
      return 'none';
    }

    function getNodeStrokeWidth(d: Node): number {
      if (d.group !== 1 && (d.betweenness ?? 0) > BRIDGE_THRESHOLD) {
        return 3;
      }
      return 0;
    }

    // Link color based on view mode
    function getLinkColor(d: Link): string {
      if (viewMode === 'temporal' && d.lastYear) {
        return temporalColorScale(d.lastYear);
      }
      if (viewMode === 'clusters') {
        // Color by shared cluster of endpoints
        const srcNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : (d.source as any).id));
        const tgtNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : (d.target as any).id));
        if (srcNode && tgtNode && srcNode.clusterId === tgtNode.clusterId) {
          return CLUSTER_COLORS[(srcNode.clusterId ?? 0) % CLUSTER_COLORS.length];
        }
        return '#d1d5db'; // gray for inter-cluster
      }
      return 'url(#link-gradient)';
    }

    // Link width — scales with citation flow
    function getLinkWidth(d: Link): number {
      const value = showCitations ? d.valueCitations / 10 : d.valuePublications;
      return Math.max(1.5, Math.sqrt(value) * 2);
    }

    // Simulation
    simulationRef.current = d3.forceSimulation(nodes as d3.SimulationNode[])
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(d => {
          const value = showCitations
            ? (d as any).valueCitations
            : (d as any).valuePublications;
          return 200 / Math.sqrt(value);
        })
      )
      .force('charge', d3.forceManyBody()
        .strength(d => {
          const node = d as Node;
          const value = showCitations ? node.sharedCitations : node.sharedPublications;
          return -300 * Math.sqrt(value);
        })
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => {
          const node = d as Node;
          const value = showCitations ? node.sharedCitations : node.sharedPublications;
          return Math.sqrt(value) * 2 + 30;
        })
      );

    // Container for all zoomable content
    const container = svg.append('g').attr('class', 'zoom-container');

    // Links
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => getLinkColor(d))
      .attr('stroke-opacity', d => {
        if (viewMode === 'temporal' && d.lastYear) return 0.8;
        if (viewMode === 'clusters') {
          const srcNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : (d.source as any).id));
          const tgtNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : (d.target as any).id));
          // Same cluster: strong, inter-cluster: subtle
          return srcNode?.clusterId === tgtNode?.clusterId ? 0.7 : 0.25;
        }
        return 0.6;
      })
      .attr('stroke-width', d => getLinkWidth(d))
      .attr('stroke-dasharray', d => {
        if (viewMode === 'clusters') {
          const srcNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : (d.source as any).id));
          const tgtNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : (d.target as any).id));
          // Dashed lines for inter-cluster connections
          if (srcNode?.clusterId !== tgtNode?.clusterId) return '4 3';
        }
        return 'none';
      });

    // Nodes
    const node = container.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Node circles
    node.append('circle')
      .attr('r', d => Math.sqrt(showCitations ? d.sharedCitations / 5 : d.sharedPublications * 10))
      .attr('fill', d => getNodeColor(d))
      .attr('fill-opacity', 0.8)
      .attr('stroke', d => getNodeStroke(d))
      .attr('stroke-width', d => getNodeStrokeWidth(d))
      .attr('filter', d => (d.betweenness ?? 0) > BRIDGE_THRESHOLD ? 'url(#bridge-glow)' : 'none');

    // Labels
    node.append('text')
      .text(d => {
        const lastName = extractLastName(d.name);
        return lastName.length > 15 ? lastName.substring(0, 12) + '...' : lastName;
      })
      .attr('x', 0)
      .attr('y', d => -Math.sqrt(showCitations ? d.sharedCitations / 5 : d.sharedPublications * 10) - 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4B5563')
      .attr('font-size', fullScreen ? '12px' : '10px');

    // Value labels
    node.append('text')
      .text(d => showCitations ? d.sharedCitations : d.sharedPublications)
      .attr('x', 0)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', fullScreen ? '10px' : '8px');

    // Tooltips — enriched with cluster/bridge/temporal info
    node.append('title')
      .text(d => {
        let text = `${d.name}\n`;
        text += `${showCitations ? 'Shared Citations' : 'Shared Publications'}: ${showCitations ? d.sharedCitations : d.sharedPublications}`;
        if (d.firstYear && d.lastYear) {
          text += `\nCollaboration: ${d.firstYear}–${d.lastYear}`;
        }
        if (d.group !== 1 && d.clusterId != null) {
          text += `\nCluster: ${d.clusterId}`;
        }
        if ((d.betweenness ?? 0) > 0.1) {
          text += `\nBridge score: ${((d.betweenness ?? 0) * 100).toFixed(0)}% — connects different research groups`;
        }
        return text;
      });

    // Click-to-highlight
    node.on('click', (_event, d) => {
      _event.stopPropagation();
      const clickedId = d.id;
      const connectedIds = new Set<string>();
      connectedIds.add(clickedId);
      links.forEach(l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
        if (sourceId === clickedId) connectedIds.add(targetId);
        if (targetId === clickedId) connectedIds.add(sourceId);
      });

      node.select('circle')
        .attr('fill-opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.15);
      node.selectAll('text')
        .attr('fill-opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.15);
      link
        .attr('stroke-opacity', (l: any) => {
          const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
          const targetId = typeof l.target === 'string' ? l.target : l.target.id;
          return (sourceId === clickedId || targetId === clickedId) ? 0.8 : 0.05;
        });
    });

    // Background click to reset
    svg.on('click', (event) => {
      if (event.target === svgRef.current) {
        node.select('circle').attr('fill-opacity', 0.8);
        node.selectAll('text').attr('fill-opacity', 1);
        link.attr('stroke-opacity', 0.6);
      }
    });

    // Zoom — only transform the container, not individual node groups
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    const initialScale = 0.8;
    svg.call(
      zoom.transform,
      d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(initialScale)
        .translate(-width / 2, -height / 2)
    );

    // Tick
    simulationRef.current.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node
        .attr('transform', d => `translate(${(d as any).x},${(d as any).y})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      stopSimulation();
    };
  }, [publications, fullScreen, viewMode, connectionLimit]);

  // This variable is no longer needed but leaving a placeholder for the component structure

  return (
    <div className={`bg-white/80 backdrop-blur-xl rounded-xl border border-primary-start/10 p-6 hover:shadow-lg transition-all ${
      fullScreen ? 'min-h-[600px]' : ''
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold gradient-text flex items-center">
          <Network className="h-5 w-5 mr-2 gradient-icon" />
          Co-author Network
        </h3>
        <div className="flex items-center space-x-4 flex-wrap">
          {/* Connection limit */}
          <div className="flex items-center space-x-2">
            <div className="group relative">
              <button
                onClick={() => handleConnectionLimit(10)}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                  connectionLimit === 10
                    ? 'bg-[#eaf4f4] text-[#2d7d7d]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>Top 10</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-white rounded-lg shadow-lg border border-gray-100 text-xs hidden group-hover:block z-20">
                <p className="text-gray-700">Show top 10 co-authors</p>
              </div>
            </div>
            <div className="group relative">
              <button
                onClick={() => handleConnectionLimit(20)}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                  connectionLimit === 20
                    ? 'bg-[#eaf4f4] text-[#2d7d7d]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>Top 20</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-white rounded-lg shadow-lg border border-gray-100 text-xs hidden group-hover:block z-20">
                <p className="text-gray-700">Show top 20 co-authors</p>
              </div>
            </div>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          {/* View mode buttons */}
          <div className="flex items-center space-x-1">
            <ViewModeButton
              active={viewMode === 'publications'}
              onClick={() => handleViewMode('publications')}
              icon={<BookOpen className="h-3.5 w-3.5" />}
              label="Papers"
              tooltip="Size by shared publications"
            />
            <ViewModeButton
              active={viewMode === 'citations'}
              onClick={() => handleViewMode('citations')}
              icon={<Citation className="h-3.5 w-3.5" />}
              label="Citations"
              tooltip="Size by shared citations, edge thickness by citation flow"
            />
            <ViewModeButton
              active={viewMode === 'temporal'}
              onClick={() => handleViewMode('temporal')}
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Timeline"
              tooltip="Edge color shows recency of collaboration (red=old, green=recent)"
            />
            <ViewModeButton
              active={viewMode === 'clusters'}
              onClick={() => handleViewMode('clusters')}
              icon={<Waypoints className="h-3.5 w-3.5" />}
              label="Clusters"
              tooltip="Detect research communities (groups of co-authors who publish together) and bridge authors who connect them"
            />
          </div>
        </div>
      </div>
      <div className={`relative ${fullScreen ? 'h-[520px]' : 'h-[calc(100%-4rem)]'}`}>
        {/* Legend */}
        <div className="absolute top-2 right-2 flex items-center space-x-4 text-xs text-gray-500 z-10">
          {viewMode === 'temporal' ? (
            <>
              <div className="flex items-center space-x-1">
                <div className="w-8 h-2 rounded" style={{ background: 'linear-gradient(to right, #d73027, #fee08b, #1a9850)' }} />
                <span>Old → Recent</span>
              </div>
            </>
          ) : viewMode === 'clusters' ? (
            <>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-[#0d9488]" />
                <span>Main Author</span>
              </div>
              <div className="flex items-center space-x-1 gap-0.5">
                {CLUSTER_COLORS.slice(0, 5).map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                ))}
                <span className="ml-1">Research groups</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-transparent" />
                <span>Bridge authors</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-0 border-t-2 border-dashed border-gray-300" />
                <span>Cross-group</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-[#0d9488]" />
                <span>Main Author</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-8 h-2 rounded" style={{ background: 'linear-gradient(to right, #440154, #21918c, #fde725)' }} />
                <span>Weak → Strong</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-transparent" />
                <span>Bridge</span>
              </div>
            </>
          )}
        </div>
        <svg
          ref={svgRef}
          className="w-full h-full"
        />
        <div className="mt-4 text-xs text-gray-500 bg-[#eaf4f4]/50 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Info className="h-4 w-4 text-[#2d7d7d] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-[#1e293b] mb-1">Network Visualization Guide</p>
              <ul className="space-y-1 text-[#64748b]">
                <li>• Node size represents {viewMode === 'citations' ? 'shared citations' : 'shared publications'}</li>
                <li>• Line thickness shows collaboration strength{viewMode === 'citations' ? ' (citation flow)' : ''}</li>
                {viewMode === 'temporal' && (
                  <li>• Edge color indicates recency: red (oldest) → green (most recent collaboration)</li>
                )}
                {viewMode === 'clusters' && (
                  <>
                    <li>• <strong>Clusters</strong> are groups of co-authors who frequently publish together — they likely represent distinct research topics, labs, or projects</li>
                    <li>• Same-color nodes share a research community; dashed gray lines cross between groups</li>
                    <li>• <strong>Bridge authors</strong> (amber outline) connect different groups and may be key interdisciplinary collaborators</li>
                  </>
                )}
                <li>• Click a node to highlight its connections</li>
                <li>• Drag nodes to explore • Mouse wheel to zoom</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Reusable view mode toggle button */
function ViewModeButton({ active, onClick, icon, label, tooltip }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs transition-colors ${
          active
            ? 'bg-[#eaf4f4] text-[#2d7d7d]'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-white rounded-lg shadow-lg border border-gray-100 text-xs hidden group-hover:block z-20">
        <p className="text-gray-700">{tooltip}</p>
      </div>
    </div>
  );
}
