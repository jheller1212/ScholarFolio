import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { Globe, Info, MapPin, Users, Flag } from 'lucide-react';
import type { Publication, CoAuthorGeoData } from '../types/scholar';
import { fetchCoAuthorGeoData } from '../services/openalex/coauthor-geo';

interface CoAuthorMapProps {
  publications: Publication[];
  authorName: string;
  authorAffiliation: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: CoAuthorGeoData | null;
}

interface WorldTopology extends Topology {
  objects: {
    countries: GeometryCollection;
    land: GeometryCollection;
  };
}

export function CoAuthorMap({ publications, authorName, authorAffiliation }: CoAuthorMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState<{ mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, data: null });
  const [mapError, setMapError] = useState(false);

  // Fetch geo data on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCoAuthorGeoData(authorName, authorAffiliation, publications).then(result => {
      if (!cancelled) {
        setGeoData(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [authorName, authorAffiliation, publications]);

  const drawMap = useCallback(() => {
    if (!svgRef.current || !containerRef.current || !geoData) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.max(360, Math.round(width * 0.5));

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const projection = d3.geoNaturalEarth1()
      .scale(width / 6.5)
      .translate([width / 2, height / 2]);

    const pathGen = d3.geoPath().projection(projection);

    // Zoom behaviour
    const zoomGroup = svg.append('g');

    let currentScale = 1;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .on('zoom', event => {
        zoomGroup.attr('transform', event.transform);
        currentScale = event.transform.k;
        // Scale dots inversely so they stay the same visual size when zoomed
        zoomGroup.selectAll<SVGCircleElement, unknown>('.geo-dot')
          .attr('r', function() { return +(this.getAttribute('data-base-r') ?? '4') / currentScale; })
          .attr('stroke-width', 1 / currentScale);
      });

    svg.call(zoom);

    // Load world TopoJSON
    fetch('https://unpkg.com/world-atlas@2/countries-110m.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((world: WorldTopology) => {
        const countries = topojson.feature(world, world.objects.countries);
        const land = topojson.feature(world, world.objects.land);

        // Draw land fill
        zoomGroup.append('path')
          .datum(land)
          .attr('d', pathGen as unknown as string)
          .attr('fill', '#f9fafb');

        // Draw country borders
        zoomGroup.append('path')
          .datum(countries)
          .attr('d', pathGen as unknown as string)
          .attr('fill', 'none')
          .attr('stroke', '#e5e7eb')
          .attr('stroke-width', 0.5);

        // Outer sphere
        zoomGroup.insert('path', ':first-child')
          .datum({ type: 'Sphere' } as d3.GeoPermissibleObjects)
          .attr('d', pathGen as unknown as string)
          .attr('fill', '#eaf4f4')
          .attr('stroke', '#d1fae5')
          .attr('stroke-width', 0.5);

        // Helper: project coordinates
        const project = (lng: number, lat: number): [number, number] | null => {
          const pt = projection([lng, lat]);
          return pt ?? null;
        };

        // Draw arcs from main author to each co-author using GeoJSON LineStrings
        // This handles wrapping correctly — D3 geoPath clips arcs at the projection boundary
        if (geoData.mainAuthor) {
            geoData.coAuthors.forEach(coAuthor => {
              const arcGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: (() => {
                    const interp = d3.geoInterpolate(
                      [geoData.mainAuthor!.lng, geoData.mainAuthor!.lat],
                      [coAuthor.lng, coAuthor.lat]
                    );
                    const pts: [number, number][] = [];
                    for (let t = 0; t <= 1; t += 0.02) {
                      pts.push(interp(t) as [number, number]);
                    }
                    return pts;
                  })()
                }
              };

              zoomGroup.append('path')
                .attr('class', 'geo-arc')
                .datum(arcGeoJson)
                .attr('d', pathGen as unknown as (d: GeoJSON.Feature<GeoJSON.LineString>) => string)
                .attr('fill', 'none')
                .attr('stroke', '#2d7d7d')
                .attr('stroke-width', 1)
                .attr('stroke-opacity', 0.15 + Math.min(0.35, coAuthor.sharedPapers / 20))
                .style('vector-effect', 'non-scaling-stroke');
            });
        }

        // Draw co-author dots
        geoData.coAuthors.forEach(coAuthor => {
          const pt = project(coAuthor.lng, coAuthor.lat);
          if (!pt) return;

          const r = Math.sqrt(coAuthor.sharedPapers) * 1.5 + 3;

          zoomGroup.append('circle')
            .attr('class', 'geo-dot')
            .attr('cx', pt[0])
            .attr('cy', pt[1])
            .attr('r', r)
            .attr('data-base-r', r)
            .attr('fill', '#2d7d7d')
            .attr('fill-opacity', 0.7)
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .on('mouseenter', (event: MouseEvent) => {
              const rect = svgRef.current!.getBoundingClientRect();
              setTooltip({
                visible: true,
                x: event.clientX - rect.left + 12,
                y: event.clientY - rect.top - 8,
                data: coAuthor
              });
            })
            .on('mousemove', (event: MouseEvent) => {
              const rect = svgRef.current!.getBoundingClientRect();
              setTooltip(prev => ({
                ...prev,
                x: event.clientX - rect.left + 12,
                y: event.clientY - rect.top - 8
              }));
            })
            .on('mouseleave', () => {
              setTooltip(prev => ({ ...prev, visible: false }));
            });
        });

        // Draw main author dot (on top)
        if (geoData.mainAuthor) {
          const mainPt = project(geoData.mainAuthor.lng, geoData.mainAuthor.lat);
          if (mainPt) {
            zoomGroup.append('circle')
              .attr('class', 'geo-dot')
              .attr('cx', mainPt[0])
              .attr('cy', mainPt[1])
              .attr('r', 5)
              .attr('data-base-r', 5)
              .attr('fill', '#0d9488')
              .attr('stroke', 'white')
              .attr('stroke-width', 1.5)
              .style('cursor', 'pointer')
              .on('mouseenter', (event: MouseEvent) => {
                const rect = svgRef.current!.getBoundingClientRect();
                setTooltip({
                  visible: true,
                  x: event.clientX - rect.left + 12,
                  y: event.clientY - rect.top - 8,
                  data: geoData.mainAuthor
                });
              })
              .on('mousemove', (event: MouseEvent) => {
                const rect = svgRef.current!.getBoundingClientRect();
                setTooltip(prev => ({
                  ...prev,
                  x: event.clientX - rect.left + 12,
                  y: event.clientY - rect.top - 8
                }));
              })
              .on('mouseleave', () => {
                setTooltip(prev => ({ ...prev, visible: false }));
              });
          }
        }
      })
      .catch(err => {
        console.warn('[CoAuthorMap] Failed to load world map data:', err);
        setMapError(true);
      });
  }, [geoData]);

  // Redraw on data change or container resize
  useEffect(() => {
    if (!geoData || !containerRef.current) return;

    drawMap();

    const observer = new ResizeObserver(() => drawMap());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [geoData, drawMap]);

  // Summary stats
  const totalCountries = new Set(geoData?.coAuthors.map(a => a.countryCode)).size;
  const totalMapped = geoData?.coAuthors.length ?? 0;
  const topCountry = (() => {
    if (!geoData?.coAuthors.length) return null;
    const countMap = new Map<string, number>();
    geoData.coAuthors.forEach(a => countMap.set(a.countryCode, (countMap.get(a.countryCode) ?? 0) + 1));
    const top = [...countMap.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  })();

  const isEmpty = !loading && geoData && geoData.coAuthors.length === 0 && !geoData.mainAuthor;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-primary-start/10 p-6 hover:shadow-lg transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold gradient-text flex items-center">
          <Globe className="h-5 w-5 mr-2 gradient-icon" />
          Co-Author World Map
        </h3>
      </div>

      {/* Map area */}
      <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden bg-[#eaf4f4]/30 border border-gray-100">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#2d7d7d] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Locating co-authors via OpenAlex...</p>
              <p className="text-xs text-gray-400">This may take 10–15 seconds — we're looking up institutions for your top co-authors.</p>
            </div>
          </div>
        )}

        {isEmpty && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <MapPin className="h-10 w-10 opacity-40" />
              <p className="text-sm">No geographic data available for co-authors</p>
            </div>
          </div>
        )}

        {mapError && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <Globe className="h-10 w-10 opacity-40" />
              <p className="text-sm">Failed to load world map data</p>
              <button
                onClick={() => { setMapError(false); drawMap(); }}
                className="text-xs text-[#2d7d7d] hover:text-[#1a5c5c] underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !isEmpty && !mapError && (
          <div className="relative">
            <svg ref={svgRef} className="w-full block" />

            {/* Tooltip */}
            {tooltip.visible && tooltip.data && (
              <div
                className="pointer-events-none absolute z-20 bg-white rounded-lg shadow-lg border border-gray-100 p-3 text-xs max-w-[200px]"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                <p className="font-semibold text-gray-900 mb-1">{tooltip.data.name}</p>
                <p className="text-gray-500 mb-1">{tooltip.data.institution}</p>
                <p className="text-gray-400">{tooltip.data.countryCode}</p>
                {tooltip.data.sharedPapers > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                    <p className="text-[#2d7d7d] font-medium">{tooltip.data.sharedPapers} shared {tooltip.data.sharedPapers === 1 ? 'paper' : 'papers'}</p>
                    <p className="text-gray-400">{tooltip.data.sharedCitations.toLocaleString()} shared citations</p>
                  </div>
                )}
              </div>
            )}

            {/* Map legend */}
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#0d9488] border-2 border-white shadow-sm" />
                <span>Main Author</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#2d7d7d] opacity-70 border border-white shadow-sm" />
                <span>Co-author</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary stats */}
      {!loading && !isEmpty && !mapError && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-[#eaf4f4]/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Flag className="h-4 w-4 text-[#2d7d7d]" />
            </div>
            <p className="text-xl font-bold text-[#2d7d7d]">{totalCountries}</p>
            <p className="text-xs text-gray-500">Countries</p>
          </div>
          <div className="bg-[#eaf4f4]/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-[#2d7d7d]" />
            </div>
            <p className="text-xl font-bold text-[#2d7d7d]">{totalMapped}</p>
            <p className="text-xs text-gray-500">Co-authors mapped</p>
          </div>
          <div className="bg-[#eaf4f4]/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <MapPin className="h-4 w-4 text-[#2d7d7d]" />
            </div>
            <p className="text-xl font-bold text-[#2d7d7d]">{topCountry ?? '—'}</p>
            <p className="text-xs text-gray-500">Top country</p>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="mt-4 text-xs text-gray-500 bg-[#eaf4f4]/50 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-[#2d7d7d] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[#1e293b] mb-1">World Map Guide</p>
            <ul className="space-y-1 text-[#64748b]">
              <li>• Teal dot marks your location; darker dots are co-authors</li>
              <li>• Dot size scales with number of shared papers</li>
              <li>• Arcs show collaboration routes across the globe</li>
              <li>• Hover a dot for details · Scroll to zoom · Drag to pan</li>
              <li>• Locations sourced from OpenAlex — top 20 co-authors by shared papers</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
