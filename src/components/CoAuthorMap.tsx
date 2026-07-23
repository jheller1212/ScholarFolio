import { useEffect, useRef, useState, useCallback } from 'react';
import { select } from 'd3-selection';
import 'd3-transition'; // registers selection.transition(), used for zoom animations
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { geoNaturalEarth1, geoPath, geoCentroid, geoInterpolate, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { Globe, Info, MapPin, Users, Flag, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Share2, Loader2 } from 'lucide-react';
import type { Publication, CoAuthorGeoData } from '../types/scholar';
import { fetchCoAuthorGeoData } from '../services/openalex/coauthor-geo';
import { timeoutSignal } from '../utils/api';
import { logCaughtError } from '../lib/errorLogger';
import { scholarService } from '../services/scholar';
import { lookupCoAuthorLink, saveCoAuthorLink } from '../services/coauthor-links';

interface CoAuthorMapProps {
  publications: Publication[];
  authorName: string;
  authorAffiliation: string;
  prefetchedData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: CoAuthorGeoData | null;
}

// Module-level cache for world topology (84KB JSON, fetched once)
let cachedWorldTopology: WorldTopology | null = null;

interface WorldTopology extends Topology {
  objects: {
    countries: GeometryCollection;
    land: GeometryCollection;
  };
}

// Continent classification based on geographic centroid
function classifyContinent(feature: GeoJSON.Feature): string {
  const [lng, lat] = geoCentroid(feature);
  if (lng >= -30 && lng <= 50 && lat > 35) return 'europe';
  if (lng >= -25 && lng <= 55 && lat <= 37 && lat >= -40) return 'africa';
  if (lng < -25 && lat > 15) return 'north-america';
  if (lng < -25 && lat <= 15) return 'south-america';
  if (lng > 100 && lat < -8) return 'oceania';
  return 'asia';
}

const CONTINENT_FILLS: Record<string, string> = {
  'europe': '#dbeafe',
  'asia': '#fef9c4',
  'africa': '#fce7f3',
  'north-america': '#d1fae5',
  'south-america': '#e0e7ff',
  'oceania': '#ccfbf1',
};

const CONTINENT_BORDERS: Record<string, string> = {
  'europe': '#bfdbfe',
  'asia': '#fde68a',
  'africa': '#fbcfe8',
  'north-america': '#a7f3d0',
  'south-america': '#c7d2fe',
  'oceania': '#99f6e4',
};

const REGION_VIEWS = [
  { id: 'world', label: 'World', center: [0, 20] as [number, number], scale: 1 },
  { id: 'europe', label: 'Europe', center: [15, 52] as [number, number], scale: 4.5 },
  { id: 'asia', label: 'Asia', center: [85, 35] as [number, number], scale: 2.2 },
  { id: 'africa', label: 'Africa', center: [20, 2] as [number, number], scale: 2.8 },
  { id: 'americas', label: 'Americas', center: [-80, 10] as [number, number], scale: 1.8 },
  { id: 'oceania', label: 'Oceania', center: [145, -25] as [number, number], scale: 4 },
];

export function CoAuthorMap({ publications, authorName, authorAffiliation, prefetchedData }: CoAuthorMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const projectionRef = useRef<GeoProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState<{ mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, data: null });
  const [clickedCoAuthor, setClickedCoAuthor] = useState<CoAuthorGeoData | null>(null);
  const [scholarIdLookup, setScholarIdLookup] = useState<{ loading: boolean; scholarId: string | null; notFound: boolean }>({ loading: false, scholarId: null, notFound: false });
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [urlInputError, setUrlInputError] = useState('');
  const [mapError, setMapError] = useState(false);
  const [activeRegion, setActiveRegion] = useState('world');

  // Use prefetched data if available, otherwise fetch on mount
  useEffect(() => {
    if (prefetchedData) {
      setGeoData(prefetchedData);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCoAuthorGeoData(authorName, authorAffiliation, publications).then(result => {
      if (!cancelled) {
        setGeoData(result);
        setLoading(false);
      }
    }).catch(err => {
      logCaughtError(err, 'openalex', 'CoAuthorMap', 'fetch-geo-data');
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [authorName, authorAffiliation, publications, prefetchedData]);

  const zoomToRegion = useCallback((regionId: string) => {
    const svg = svgRef.current;
    const projection = projectionRef.current;
    const zoom = zoomRef.current;
    const container = containerRef.current;
    if (!svg || !projection || !zoom || !container) return;

    setActiveRegion(regionId);

    if (regionId === 'world') {
      select(svg).transition().duration(750)
        .call(zoom.transform, zoomIdentity);
      return;
    }

    const region = REGION_VIEWS.find(r => r.id === regionId);
    if (!region) return;

    const width = container.clientWidth;
    const isMobile = width < 640;
    const height = isMobile ? Math.max(280, Math.round(width * 0.65)) : Math.max(360, Math.round(width * 0.5));
    const pt = projection(region.center);
    if (!pt) return;

    const transform = zoomIdentity
      .translate(width / 2, height / 2)
      .scale(region.scale)
      .translate(-pt[0], -pt[1]);

    select(svg).transition().duration(750)
      .call(zoom.transform, transform);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(300)
      .call(zoomRef.current.scaleBy, 1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(300)
      .call(zoomRef.current.scaleBy, 1 / 1.5);
  }, []);

  const handleReset = useCallback(() => {
    zoomToRegion('world');
  }, [zoomToRegion]);

  const drawMap = useCallback(() => {
    if (!svgRef.current || !containerRef.current || !geoData) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    if (width === 0) return; // Container not yet laid out (hidden tab on mobile)
    const isMobile = width < 640;
    const height = isMobile ? Math.max(280, Math.round(width * 0.65)) : Math.max(360, Math.round(width * 0.5));

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const projection = geoNaturalEarth1()
      .scale(width / 6.5)
      .translate([width / 2, height / 2]);
    projectionRef.current = projection;

    const pathGen = geoPath().projection(projection);

    // Zoom behaviour
    const zoomGroup = svg.append('g');

    let currentScale = 1;
    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .filter((event: Event) => {
        // Don't let zoom intercept clicks/touches on dots — allow them to bubble to the dot's click handler
        const target = event.target as SVGElement;
        if (target.classList?.contains('geo-dot')) {
          // Allow scroll/pinch zoom on dots, but block drag (which eats click)
          return event.type === 'wheel' || event.type === 'dblclick';
        }
        return true;
      })
      .on('zoom', event => {
        zoomGroup.attr('transform', event.transform);
        currentScale = event.transform.k;
        zoomGroup.selectAll<SVGCircleElement, unknown>('.geo-dot')
          .attr('r', function() { return +(this.getAttribute('data-base-r') ?? '4') / currentScale; })
          .attr('stroke-width', 1 / currentScale);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Dismiss tooltip when tapping empty map area on mobile
    svg.on('touchstart', () => {
      setTooltip(prev => ({ ...prev, visible: false }));
    }, { passive: true } as unknown as boolean);

    // Load world TopoJSON (cached after first fetch)
    const worldPromise = cachedWorldTopology
      ? Promise.resolve(cachedWorldTopology)
      : fetch('https://unpkg.com/world-atlas@2/countries-110m.json', { signal: timeoutSignal(15000) })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then((data: WorldTopology) => { cachedWorldTopology = data; return data; });

    worldPromise.then((world: WorldTopology) => {
        const countries = topojson.feature(world, world.objects.countries);

        // Outer sphere (ocean)
        zoomGroup.insert('path', ':first-child')
          .datum({ type: 'Sphere' } as GeoPermissibleObjects)
          .attr('d', pathGen as unknown as string)
          .attr('fill', '#eaf4f4')
          .attr('stroke', '#d1fae5')
          .attr('stroke-width', 0.5);

        // Draw individual countries with continent coloring
        zoomGroup.selectAll('.country')
          .data((countries as unknown as GeoJSON.FeatureCollection).features)
          .join('path')
          .attr('class', 'country')
          .attr('d', (d: GeoJSON.Feature) => pathGen(d) ?? '')
          .attr('fill', (d: GeoJSON.Feature) => {
            const continent = classifyContinent(d);
            return CONTINENT_FILLS[continent] || '#f9fafb';
          })
          .attr('stroke', (d: GeoJSON.Feature) => {
            const continent = classifyContinent(d);
            return CONTINENT_BORDERS[continent] || '#e5e7eb';
          })
          .attr('stroke-width', 0.5);

        // Helper: project coordinates
        const project = (lng: number, lat: number): [number, number] | null => {
          const pt = projection([lng, lat]);
          return pt ?? null;
        };

        // Draw arcs from main author to each co-author
        if (geoData.mainAuthor) {
          geoData.coAuthors.forEach(coAuthor => {
            const arcGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: (() => {
                  const interp = geoInterpolate(
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
            })
            .on('touchstart', (event: TouchEvent) => {
              event.stopPropagation();
              const touch = event.touches[0];
              const rect = svgRef.current!.getBoundingClientRect();
              setTooltip({
                visible: true,
                x: touch.clientX - rect.left + 12,
                y: touch.clientY - rect.top - 8,
                data: coAuthor
              });
            }, { passive: true })
            .on('click', (event: MouseEvent) => {
              event.stopPropagation();
              setClickedCoAuthor(coAuthor);
              setScholarIdLookup({ loading: false, scholarId: null, notFound: false });
              setShowUrlInput(false);
              setUrlInputValue('');
              setUrlInputError('');
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
              })
              .on('touchstart', (event: TouchEvent) => {
                event.stopPropagation();
                const touch = event.touches[0];
                const rect = svgRef.current!.getBoundingClientRect();
                setTooltip({
                  visible: true,
                  x: touch.clientX - rect.left + 12,
                  y: touch.clientY - rect.top - 8,
                  data: geoData.mainAuthor
                });
              }, { passive: true });
          }
        }
      })
      .catch(err => {
        logCaughtError(err, 'navigation', 'CoAuthorMap', 'load-world-topojson');
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

      {/* Region buttons */}
      {!loading && !isEmpty && !mapError && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {REGION_VIEWS.map(region => (
            <button
              key={region.id}
              onClick={() => zoomToRegion(region.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeRegion === region.id
                  ? 'bg-[#2d7d7d] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {region.label}
            </button>
          ))}
        </div>
      )}

      {/* Map area */}
      <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden bg-[#eaf4f4]/30 border border-gray-100">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#2d7d7d] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Locating co-authors via OpenAlex...</p>
              <p className="text-xs text-gray-400">This may take 10-15 seconds — we're looking up institutions for your top co-authors.</p>
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
            <svg ref={svgRef} className="w-full block" style={{ touchAction: 'none' }} />

            {/* Zoom controls */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              <button
                onClick={handleZoomIn}
                className="w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleZoomOut}
                className="w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleReset}
                className="w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                title="Reset view"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

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

            {/* Map legend — compact on mobile, full on desktop */}
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 text-xs text-gray-500 bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-sm border border-gray-100">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#0d9488] border-2 border-white shadow-sm" />
                <span>Main Author</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#2d7d7d] opacity-70 border border-white shadow-sm" />
                <span>Co-author</span>
              </div>
              <div className="hidden sm:block border-t border-gray-100 pt-1.5 mt-0.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: CONTINENT_FILLS['europe'] }} />
                  <span>Europe</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: CONTINENT_FILLS['asia'] }} />
                  <span>Asia</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: CONTINENT_FILLS['north-america'] }} />
                  <span>Americas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: CONTINENT_FILLS['africa'] }} />
                  <span>Africa</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: CONTINENT_FILLS['oceania'] }} />
                  <span>Oceania</span>
                </div>
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

      {/* Co-author click popup */}
      {clickedCoAuthor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setClickedCoAuthor(null)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">{clickedCoAuthor.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{clickedCoAuthor.institution}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{clickedCoAuthor.countryCode}</p>
              </div>
              <button onClick={() => setClickedCoAuthor(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            {clickedCoAuthor.sharedPapers > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 pb-3 border-b border-gray-100 dark:border-slate-700">
                <span className="text-[#2d7d7d] font-medium">{clickedCoAuthor.sharedPapers}</span> shared {clickedCoAuthor.sharedPapers === 1 ? 'paper' : 'papers'} · {clickedCoAuthor.sharedCitations.toLocaleString()} citations
              </div>
            )}
            <div className="space-y-2">
              <button
                onClick={async () => {
                  if (scholarIdLookup.loading) return;
                  if (scholarIdLookup.scholarId) {
                    window.open(`${window.location.origin}/scholar/${encodeURIComponent(scholarIdLookup.scholarId)}`, '_blank');
                    return;
                  }
                  if (scholarIdLookup.notFound) {
                    setShowUrlInput(true);
                    setUrlInputValue('');
                    setUrlInputError('');
                    return;
                  }
                  // Open window immediately to avoid popup blocker
                  const newWindow = window.open('about:blank', '_blank');
                  if (newWindow) {
                    newWindow.document.write(`<!DOCTYPE html><html><head><title>Scholar Folio</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafa;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#334155}.wrap{text-align:center}.spinner{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#2d7d7d;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}.title{font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px}.sub{font-size:13px;color:#64748b}</style></head><body><div class="wrap"><div class="spinner"></div><div class="title">Loading profile</div><div class="sub">${clickedCoAuthor.name.replace(/'/g, '&#39;')}</div></div></body></html>`);
                    newWindow.document.close();
                  }
                  setScholarIdLookup({ loading: true, scholarId: null, notFound: false });
                  const searchName = clickedCoAuthor.fullName || clickedCoAuthor.name;
                  try {
                    // 1. Check community-contributed cache first
                    const cached = await lookupCoAuthorLink(searchName);
                    if (cached?.scholar_id) {
                      setScholarIdLookup({ loading: false, scholarId: cached.scholar_id, notFound: false });
                      if (newWindow) {
                        newWindow.location.href = `${window.location.origin}/scholar/${encodeURIComponent(cached.scholar_id)}`;
                      }
                      return;
                    }
                    // 2. Search with institution for better disambiguation
                    const queryWithInst = clickedCoAuthor.institution
                      ? `${searchName} ${clickedCoAuthor.institution}`
                      : searchName;
                    let results = await scholarService.searchAuthors(queryWithInst);
                    if (results.length === 0 && clickedCoAuthor.institution) {
                      results = await scholarService.searchAuthors(searchName);
                    }
                    // Validate: check the result's last name matches
                    const targetLast = searchName.split(/\s+/).pop()?.toLowerCase() ?? '';
                    const match = results.find(r => {
                      const resultLast = r.name.split(/\s+/).pop()?.toLowerCase() ?? '';
                      return resultLast === targetLast;
                    });
                    if (match) {
                      // Save to cache for future lookups
                      saveCoAuthorLink({ name: searchName, scholarId: match.authorId, openalexId: clickedCoAuthor.openalexId, institution: clickedCoAuthor.institution }).catch(() => {});
                      setScholarIdLookup({ loading: false, scholarId: match.authorId, notFound: false });
                      if (newWindow) {
                        newWindow.location.href = `${window.location.origin}/scholar/${encodeURIComponent(match.authorId)}`;
                      }
                    } else {
                      setScholarIdLookup({ loading: false, scholarId: null, notFound: true });
                      newWindow?.close();
                    }
                  } catch {
                    setScholarIdLookup({ loading: false, scholarId: null, notFound: true });
                    newWindow?.close();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] transition-colors"
              >
                {scholarIdLookup.loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Looking up profile...</>
                ) : scholarIdLookup.notFound ? (
                  <><MapPin className="h-4 w-4" /> Link Google Scholar profile</>
                ) : (
                  <><ExternalLink className="h-4 w-4" /> View on ScholarFolio</>
                )}
              </button>

              {/* URL input modal for manual linking */}
              {showUrlInput && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    We couldn't automatically find <strong>{clickedCoAuthor.fullName || clickedCoAuthor.name}</strong> on Google Scholar. Multiple authors may share this name. Paste their Google Scholar profile URL below to link it.
                  </p>
                  <input
                    type="url"
                    value={urlInputValue}
                    onChange={e => { setUrlInputValue(e.target.value); setUrlInputError(''); }}
                    placeholder="https://scholar.google.com/citations?user=..."
                    className="w-full text-xs px-2.5 py-2 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-[#2d7d7d] focus:border-[#2d7d7d] outline-none"
                  />
                  {urlInputError && <p className="text-xs text-red-600 dark:text-red-400">{urlInputError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const validation = scholarService.validateProfileUrl(urlInputValue);
                        if (!validation.isValid || !validation.userId) {
                          setUrlInputError('Please enter a valid Google Scholar profile URL (must contain ?user=...)');
                          return;
                        }
                        const scholarId = validation.userId;
                        const searchName = clickedCoAuthor.fullName || clickedCoAuthor.name;
                        // Save to community cache
                        saveCoAuthorLink({
                          name: searchName,
                          scholarId,
                          scholarUrl: urlInputValue,
                          openalexId: clickedCoAuthor.openalexId,
                          institution: clickedCoAuthor.institution,
                        }).catch(() => {});
                        setScholarIdLookup({ loading: false, scholarId, notFound: false });
                        setShowUrlInput(false);
                        window.open(`${window.location.origin}/scholar/${encodeURIComponent(scholarId)}`, '_blank');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" /> Link &amp; View
                    </button>
                    <button
                      onClick={() => {
                        const searchName = clickedCoAuthor.fullName || clickedCoAuthor.name;
                        window.open(`https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(searchName)}`, '_blank');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Search Scholar
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  const text = `Check out your research profile on ScholarFolio: ${window.location.origin}`;
                  if (navigator.share) {
                    navigator.share({ title: `${clickedCoAuthor.name} — ScholarFolio`, text, url: window.location.origin });
                  } else {
                    navigator.clipboard.writeText(text);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Share2 className="h-4 w-4" /> Share with {clickedCoAuthor.name.split(' ')[0]}
              </button>
            </div>
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
              <li>• Click a co-author dot to view their profile or share ScholarFolio with them</li>
              <li>• Tap or hover a dot for details · Pinch or scroll to zoom · Drag to pan</li>
              <li>• Use region buttons or zoom controls to explore specific areas</li>
              <li>• Locations sourced from OpenAlex — top 50 co-authors by shared papers</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
