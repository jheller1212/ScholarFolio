import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Network, Share2, BookOpen, Presentation as Citation, Users, Info } from 'lucide-react';
import type { Publication } from '../types/scholar';
import { extractLastName } from '../utils/names';

interface Node {
  id: string;
  name: string;
  group: number;
  citations: number;
  sharedPublications: number;
  sharedCitations: number;
}

interface Link {
  source: string;
  target: string;
  valuePublications: number;
  valueCitations: number;
}

interface CitationNetworkProps {
  publications: Publication[];
  fullScreen?: boolean;
}

export function CitationNetwork({ publications, fullScreen = false }: CitationNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const [showCitations, setShowCitations] = useState(false);
  const [connectionLimit, setConnectionLimit] = useState<10 | 20>(10);

  // Function to stop the current simulation
  const stopSimulation = () => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
  };

  // Handle toggle changes
  const handleShowCitations = () => {
    stopSimulation();
    setShowCitations(!showCitations);
  };

  const handleConnectionLimit = (limit: 10 | 20) => {
    stopSimulation();
    setConnectionLimit(limit);
  };

  useEffect(() => {
    if (!svgRef.current || !publications.length) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();
    stopSimulation();

    // Find the main author (most frequent author across all publications)
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

    // Process data
    const nodes: Node[] = [];
    const links: Link[] = [];
    const authorMap = new Map<string, { 
      publications: Set<string>,
      citations: number,
      papers: Set<string>,
      coAuthors: Map<string, { papers: Set<string>, citations: number }>
    }>();

    // Add the main author as the central node
    nodes.push({
      id: mainAuthor,
      name: mainAuthor,
      group: 1,
      citations: publications.reduce((sum, pub) => sum + pub.citations, 0),
      sharedPublications: publications.length,
      sharedCitations: publications.reduce((sum, pub) => sum + pub.citations, 0)
    });

    // Process co-authors and their relationships
    publications.forEach(pub => {
      const coAuthors = pub.authors.filter(author => author !== mainAuthor);
      
      coAuthors.forEach(author => {
        if (!authorMap.has(author)) {
          authorMap.set(author, {
            publications: new Set(),
            citations: 0,
            papers: new Set(),
            coAuthors: new Map()
          });
        }
        const authorData = authorMap.get(author)!;
        authorData.publications.add(pub.title);
        authorData.citations += pub.citations;
        authorData.papers.add(pub.title);

        coAuthors.forEach(coAuthor => {
          if (author !== coAuthor) {
            if (!authorData.coAuthors.has(coAuthor)) {
              authorData.coAuthors.set(coAuthor, {
                papers: new Set(),
                citations: 0
              });
            }
            const coAuthorData = authorData.coAuthors.get(coAuthor)!;
            coAuthorData.papers.add(pub.title);
            coAuthorData.citations += pub.citations;
          }
        });
      });
    });

    // Sort co-authors by connection strength
    const sortedByStrength = Array.from(authorMap.entries()).sort((a, b) => {
      const valueA = showCitations ? a[1].citations : a[1].publications.size;
      const valueB = showCitations ? b[1].citations : b[1].publications.size;
      return valueB - valueA;
    });

    // Filter top connections based on limit
    const filteredAuthors = sortedByStrength.slice(0, connectionLimit);

    // Add filtered co-author nodes and their connections
    const addedAuthors = new Set<string>([mainAuthor]);
    
    filteredAuthors.forEach(([author, data]) => {
      nodes.push({
        id: author,
        name: author,
        group: 2,
        citations: data.citations,
        sharedPublications: data.publications.size,
        sharedCitations: data.citations
      });
      addedAuthors.add(author);

      links.push({
        source: mainAuthor,
        target: author,
        valuePublications: data.publications.size,
        valueCitations: data.citations
      });

      data.coAuthors.forEach((coAuthorData, coAuthor) => {
        if (addedAuthors.has(coAuthor)) {
          links.push({
            source: author,
            target: coAuthor,
            valuePublications: coAuthorData.papers.size,
            valueCitations: coAuthorData.citations
          });
        }
      });
    });

    // Set up the visualization
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', [0, 0, width, height]);

    // Create a gradient for links
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'link-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#2d7d7d');

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#64748b');

    // Create the simulation with stronger forces
    simulationRef.current = d3.forceSimulation(nodes as d3.SimulationNode[])
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(d => {
          const value = showCitations 
            ? (d as any).valueCitations 
            : (d as any).valuePublications;
          // Closer distance for stronger connections
          return 200 / Math.sqrt(value);
        })
      )
      .force('charge', d3.forceManyBody()
        .strength(d => {
          const node = d as Node;
          const value = showCitations ? node.sharedCitations : node.sharedPublications;
          // Stronger repulsion for larger nodes
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

    // Create the links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'url(#link-gradient)')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => 
        Math.sqrt(showCitations ? d.valueCitations / 10 : d.valuePublications) * 2
      );

    // Create the nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => Math.sqrt(showCitations ? d.sharedCitations / 5 : d.sharedPublications * 10))
      .attr('fill', d => d.group === 1 ? '#2d7d7d' : '#64748b')
      .attr('fill-opacity', 0.8);

    // Update the node labels to use the extracted last name
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

    // Add value labels
    node.append('text')
      .text(d => showCitations ? d.sharedCitations : d.sharedPublications)
      .attr('x', 0)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', fullScreen ? '10px' : '8px');

    // Update tooltips to show full name
    node.append('title')
      .text(d => `${d.name}\n${showCitations ? 'Shared Citations' : 'Shared Publications'}: ${
        showCitations ? d.sharedCitations : d.sharedPublications
      }`);

    // Click-to-highlight: clicking a node highlights its connections
    node.on('click', (_event, d) => {
      const clickedId = d.id;
      const connectedIds = new Set<string>();
      connectedIds.add(clickedId);
      links.forEach(l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
        if (sourceId === clickedId) connectedIds.add(targetId);
        if (targetId === clickedId) connectedIds.add(sourceId);
      });

      // Dim non-connected nodes and links
      node.select('circle')
        .attr('fill-opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.15);
      node.select('text')
        .attr('fill-opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.15);
      link
        .attr('stroke-opacity', (l: any) => {
          const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
          const targetId = typeof l.target === 'string' ? l.target : l.target.id;
          return (sourceId === clickedId || targetId === clickedId) ? 0.8 : 0.05;
        });
    });

    // Click on background to reset highlighting
    svg.on('click', (event) => {
      if (event.target === svgRef.current) {
        node.select('circle').attr('fill-opacity', 0.8);
        node.selectAll('text').attr('fill-opacity', 1);
        link.attr('stroke-opacity', 0.6);
      }
    });

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        svg.selectAll('g').attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial zoom out
    const initialScale = 0.8;
    svg.call(
      zoom.transform,
      d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(initialScale)
        .translate(-width / 2, -height / 2)
    );

    // Update positions on each tick
    simulationRef.current.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node
        .attr('transform', d => `translate(${(d as any).x},${(d as any).y})`);
    });

    // Drag functions
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

    // Cleanup
    return () => {
      stopSimulation();
    };
  }, [publications, fullScreen, showCitations, connectionLimit]);

  return (
    <div className={`bg-white/80 backdrop-blur-xl rounded-xl border border-primary-start/10 p-6 hover:shadow-lg transition-all ${
      fullScreen ? 'min-h-[600px]' : ''
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold gradient-text flex items-center">
          <Network className="h-5 w-5 mr-2 gradient-icon" />
          Co-author Network
        </h3>
        <div className="flex items-center space-x-4">
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
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-white rounded-lg shadow-lg border border-gray-100 text-xs hidden group-hover:block">
                <p className="text-gray-700">Show top 10 co-authors by collaboration frequency</p>
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
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-white rounded-lg shadow-lg border border-gray-100 text-xs hidden group-hover:block">
                <p className="text-gray-700">Show top 20 co-authors by collaboration frequency</p>
              </div>
            </div>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center space-x-2">
            <div className="group relative">
              <button
                onClick={handleShowCitations}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                  !showCitations
                    ? 'bg-[#eaf4f4] text-[#2d7d7d]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Publications</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-white rounded-lg shadow-lg border border-gray-100 text-xs hidden group-hover:block">
                <p className="font-medium text-gray-900 mb-1">Publication View</p>
                <p className="text-gray-700">Shows connections based on number of shared publications</p>
              </div>
            </div>
            <div className="group relative">
              <button
                onClick={handleShowCitations}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                  showCitations
                    ? 'bg-[#eaf4f4] text-[#2d7d7d]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Citation className="h-3.5 w-3.5" />
                <span>Citations</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-white rounded-lg shadow-lg border border-gray-100 text-xs hidden group-hover:block">
                <p className="font-medium text-gray-900 mb-1">Citation View</p>
                <p className="text-gray-700">Shows connections weighted by total shared citations</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={`relative ${fullScreen ? 'h-[520px]' : 'h-[calc(100%-4rem)]'}`}>
        <div className="absolute top-2 right-2 flex items-center space-x-4 text-xs text-gray-500 z-10">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-[#2d7d7d]" />
            <span>Main Author</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-[#64748b]" />
            <span>Co-authors</span>
          </div>
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
                <li>• Node size represents the number of {showCitations ? 'shared citations' : 'shared publications'}</li>
                <li>• Line thickness shows collaboration strength</li>
                <li>• Click a node to highlight its connections</li>
                <li>• Drag nodes to explore connections</li>
                <li>• Use mouse wheel to zoom in/out</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}