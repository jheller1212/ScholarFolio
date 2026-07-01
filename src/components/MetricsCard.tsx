import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Users,
  BookOpen,
  Presentation as Citation,
  Award,
  Network,
  Zap,
  BarChart,
  User,
  UserPlus,
  UsersRound,
  Clock,
  UserCheck,
  Target,
  Sigma,
  Sparkles,
  Lightbulb,
  Scale,
  Gauge,
  Workflow,
  Crown,
  Activity,
  Hourglass,
  PieChart,
  Timer,
  Unlock,
  Lock
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { metricInfo } from '../data/metricInfo';

interface MetricsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: 'citations' | 'hIndex' | 'gIndex' | 'publications' | 'i10Index' | 'scr' | 'hpIndex' |
        'sIndex' | 'rcr' | 'pubsPerYear' | 'network' | 'coAuthors' | 'avgAuthors' | 'soloAuthor' |
        'h5Index' | 'acc5' | 'citationsPerYear' | 'topCoAuthor' | 'avgCitationsPerPaper' |
        'citationGrowth' | 'peak' | 'trend' | 'fwci' | 'topDecile' | 'halfLife' | 'gini' | 'ageNormalized' |
        'oaPercent' | 'goldOa' | 'greenOa' | 'hybridOa' | 'bronzeOa' | 'closedAccess' | 'meanIF' |
        'pindex' | 'owpi' | 'weightedCitations' | 'influential' | 'preprint' | 'repository';
}

function useCountUp(target: number | string, duration = 600) {
  const [display, setDisplay] = useState<string>('0');
  const hasRun = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasRun.current) return;
    const numericTarget = typeof target === 'string' ? parseFloat(target.replace(/,/g, '')) : target;
    if (isNaN(numericTarget)) {
      setDisplay(String(target));
      return;
    }
    // Preserve a leading "+" and any non-numeric suffix (e.g. "%", " yrs")
    // through the animation — parseFloat strips them, which used to freeze
    // "53%" as "53". The leading \s* keeps the space in "12 yrs".
    const prefix = typeof target === 'string' && target.trim().startsWith('+') ? '+' : '';
    const suffix = typeof target === 'string' ? (target.match(/\s*[^\d.,\s+-]+\s*$/)?.[0] ?? '') : '';

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || hasRun.current) return;
      hasRun.current = true;
      observer.disconnect();

      const isDecimal = String(target).includes('.');
      const start = performance.now();

      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = numericTarget * eased;

        if (progress < 1) {
          if (isDecimal) {
            setDisplay(prefix + current.toFixed(1) + suffix);
          } else if (typeof target === 'string' && target.includes(',')) {
            setDisplay(prefix + Math.round(current).toLocaleString() + suffix);
          } else {
            setDisplay(prefix + String(Math.round(current)) + suffix);
          }
          requestAnimationFrame(animate);
        } else {
          // Final frame: snap to the exact original value so no format the
          // interpolation branches mishandle (2-decimal FWCI, "12 yrs", …)
          // sticks on screen in a mangled form.
          setDisplay(String(target));
        }
      };
      requestAnimationFrame(animate);
    }, { threshold: 0.3 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { display, ref };
}

/** Placeholder card shown while an async metric section is still loading. */
export function MetricsCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-card w-full">
      <div className="flex items-start gap-2.5 animate-pulse">
        <div className="p-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg mt-0.5 flex-shrink-0">
          <div className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-2 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-10 bg-gray-200 dark:bg-slate-700 rounded mt-2" />
          <div className="h-2 w-14 bg-gray-100 dark:bg-slate-700/60 rounded mt-1.5" />
        </div>
      </div>
    </div>
  );
}

export function MetricsCard({ title, value, subtitle, icon }: MetricsCardProps) {
  const { display, ref: countRef } = useCountUp(value);
  const getIcon = () => {
    switch (icon) {
      // Impact metrics
      case 'citations': return <Citation className="h-3.5 w-3.5" />;
      case 'avgCitationsPerPaper': return <Target className="h-3.5 w-3.5" />;
      case 'citationsPerYear': return <Clock className="h-3.5 w-3.5" />;
      case 'citationGrowth': return <Sparkles className="h-3.5 w-3.5" />;
      case 'peak': return <Crown className="h-3.5 w-3.5" />;
      case 'trend': return <Activity className="h-3.5 w-3.5" />;
      
      // Index metrics
      case 'hIndex': return <Sigma className="h-3.5 w-3.5" />;
      case 'gIndex': return <BarChart className="h-3.5 w-3.5" />;
      case 'i10Index': return <Award className="h-3.5 w-3.5" />;
      case 'h5Index': return <TrendingUp className="h-3.5 w-3.5" />;
      
      // Field metrics
      case 'rcr': return <Scale className="h-3.5 w-3.5" />;
      case 'fwci': return <Gauge className="h-3.5 w-3.5" />;
      case 'topDecile': return <Crown className="h-3.5 w-3.5" />;
      case 'meanIF': return <TrendingUp className="h-3.5 w-3.5" />;
      
      // Publication metrics
      case 'publications': return <BookOpen className="h-3.5 w-3.5" />;
      case 'pubsPerYear': return <Lightbulb className="h-3.5 w-3.5" />;
      
      // Collaboration metrics
      case 'network': return <Network className="h-3.5 w-3.5" />;
      case 'coAuthors': return <Users className="h-3.5 w-3.5" />;
      case 'avgAuthors': return <UsersRound className="h-3.5 w-3.5" />;
      case 'soloAuthor': return <User className="h-3.5 w-3.5" />;
      case 'topCoAuthor': return <UserCheck className="h-3.5 w-3.5" />;
      
      // Advanced metrics
      case 'halfLife': return <Hourglass className="h-3.5 w-3.5" />;
      case 'gini': return <PieChart className="h-3.5 w-3.5" />;
      case 'ageNormalized': return <Timer className="h-3.5 w-3.5" />;

      // Other metrics
      case 'acc5': return <UserPlus className="h-3.5 w-3.5" />;
      case 'scr': return <Workflow className="h-3.5 w-3.5" />;
      case 'sIndex': return <Zap className="h-3.5 w-3.5" />;
      case 'hpIndex': return <Award className="h-3.5 w-3.5" />;

      // P-Index metrics
      case 'pindex': return <Award className="h-3.5 w-3.5" />;
      case 'owpi': return <Scale className="h-3.5 w-3.5" />;
      case 'weightedCitations': return <Citation className="h-3.5 w-3.5" />;

      // Open Access metrics
      case 'oaPercent': return <Unlock className="h-3.5 w-3.5" />;
      case 'goldOa': return <Unlock className="h-3.5 w-3.5" />;
      case 'greenOa': return <Unlock className="h-3.5 w-3.5" />;
      case 'hybridOa': return <Unlock className="h-3.5 w-3.5" />;
      case 'bronzeOa': return <Unlock className="h-3.5 w-3.5" />;
      case 'closedAccess': return <Lock className="h-3.5 w-3.5" />;
      case 'influential': return <Sparkles className="h-3.5 w-3.5" />;
      case 'preprint': return <BookOpen className="h-3.5 w-3.5" />;
      case 'repository': return <Network className="h-3.5 w-3.5" />;

      default: return <Citation className="h-3.5 w-3.5" />;
    }
  };

  const getMetricKey = () => {
    switch (icon) {
      case 'citations': return 'citations';
      case 'citationsPerYear': return 'citationsPerYear';
      case 'avgCitationsPerPaper': return 'avgCitationsPerPaper';
      case 'citationGrowth': return 'citationGrowth';
      case 'hIndex': return 'hIndex';
      case 'gIndex': return 'gIndex';
      case 'publications': return 'publications';
      case 'i10Index': return 'i10Index';
      case 'scr': return 'selfCitationRate';
      case 'hpIndex': return 'hpIndex';
      case 'sIndex': return 'sIndex';
      case 'rcr': return 'rcr';
      case 'fwci': return 'fwci';
      case 'topDecile': return 'topDecile';
      case 'meanIF': return 'meanIF';
      case 'pubsPerYear': return 'pubsPerYear';
      case 'network': return 'collaborationScore';
      case 'coAuthors': return 'coAuthors';
      case 'avgAuthors': return 'averageAuthors';
      case 'soloAuthor': return 'soloAuthor';
      case 'h5Index': return 'h5Index';
      case 'acc5': return 'acc5';
      case 'topCoAuthor': return 'topCoAuthor';
      case 'peak': return 'peak';
      case 'trend': return 'trend';
      case 'halfLife': return 'halfLife';
      case 'gini': return 'gini';
      case 'ageNormalized': return 'ageNormalized';
      case 'oaPercent': return 'oaPercent';
      case 'goldOa': return 'goldOa';
      case 'greenOa': return 'greenOa';
      case 'hybridOa': return 'hybridOa';
      case 'bronzeOa': return 'bronzeOa';
      case 'closedAccess': return 'closedAccess';
      case 'pindex': return 'pindex';
      case 'owpi': return 'owpi';
      case 'weightedCitations': return 'weightedCitations';
      case 'influential': return 'citations';
      case 'preprint': return 'citations';
      case 'repository': return 'citations';
      default: return 'citations';
    }
  };

  const tooltipInfo = metricInfo[getMetricKey()];

  const getIconGradient = () => {
    switch (icon) {
      // Impact / citation metrics → amber
      case 'citations': case 'hIndex': case 'gIndex': case 'i10Index': case 'h5Index':
      case 'avgCitationsPerPaper': case 'citationsPerYear': case 'peak': case 'acc5':
      case 'ageNormalized': case 'halfLife': case 'gini':
        return 'from-cat-impact-from to-cat-impact-to';
      // Trend metrics → blue
      case 'citationGrowth': case 'trend': case 'publications': case 'pubsPerYear':
        return 'from-cat-trend-from to-cat-trend-to';
      // Collaboration metrics → teal (brand)
      case 'network': case 'coAuthors': case 'avgAuthors': case 'soloAuthor': case 'topCoAuthor':
        return 'from-cat-collab-from to-cat-collab-to';
      // P-Index → violet
      case 'pindex': case 'owpi': case 'weightedCitations':
        return 'from-violet-500 to-purple-600';
      // Field-normalized → indigo
      case 'fwci': case 'topDecile': case 'rcr': case 'meanIF':
        return 'from-cat-field-from to-cat-field-to';
      // Open access → green
      case 'oaPercent': case 'goldOa': case 'greenOa': case 'hybridOa': case 'bronzeOa': case 'closedAccess':
      case 'preprint': case 'repository':
        return 'from-cat-oa-from to-cat-oa-to';
      // Semantic Scholar → indigo
      case 'influential':
        return 'from-cat-field-from to-cat-field-to';
      default:
        return 'from-primary-start to-primary-end';
    }
  };

  const cardContent = (
    <div ref={countRef} className={`bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-card w-full transition-all duration-200 hover:shadow-card-hover hover:border-gray-200 dark:hover:border-slate-600 hover:scale-[1.02] ${tooltipInfo ? 'cursor-help' : ''}`}>
      <div className="flex items-start gap-2.5">
        <div className={`p-1.5 bg-gradient-to-br ${getIconGradient()} rounded-lg text-white mt-0.5 flex-shrink-0`}>
          {getIcon()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 leading-none">{title}</p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-1.5 truncate">{display}</p>
          {subtitle && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (!tooltipInfo) {
    return cardContent;
  }

  return (
    <Tooltip content={tooltipInfo}>
      {cardContent}
    </Tooltip>
  );
}