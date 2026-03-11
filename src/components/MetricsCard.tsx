import React from 'react';
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
  Timer
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
        'citationGrowth' | 'peak' | 'trend' | 'fwci' | 'halfLife' | 'gini' | 'ageNormalized';
}

export function MetricsCard({ title, value, subtitle, icon }: MetricsCardProps) {
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
      default: return 'citations';
    }
  };

  const tooltipInfo = metricInfo[getMetricKey()];

  const cardContent = (
    <div className={`bg-white p-3 rounded-xl border border-gray-100 shadow-card w-full transition-all duration-200 hover:shadow-card-hover hover:border-gray-200 ${tooltipInfo ? 'cursor-help' : ''}`}>
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 bg-gradient-to-br from-primary-start to-primary-end rounded-lg text-white mt-0.5 flex-shrink-0">
          {getIcon()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-gray-400 leading-none">{title}</p>
          <p className="text-sm font-bold text-gray-900 mt-1.5 truncate">{value}</p>
          {subtitle && (
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5 truncate">{subtitle}</p>
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