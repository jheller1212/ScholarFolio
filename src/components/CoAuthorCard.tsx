import React from 'react';
import { User, ExternalLink, BookOpen } from 'lucide-react';
import type { Publication } from '../types/scholar';

interface CoAuthorCardProps {
  name: string;
  imageUrl?: string;
  citations: number;
  hIndex: number;
  profileUrl?: string;
  affiliation: string;
  sharedPublications: number;
  sharedPapers: Publication[];
}

export function CoAuthorCard({ 
  name, 
  imageUrl, 
  citations, 
  hIndex, 
  profileUrl,
  affiliation,
  sharedPublications,
  sharedPapers 
}: CoAuthorCardProps) {
  const [showPapers, setShowPapers] = React.useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors overflow-hidden">
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={name} 
              className="w-12 h-12 rounded-lg object-cover bg-[#eaf4f4]"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXVzZXIiPjxwYXRoIGQ9Ik0xOSAyMXYtMmE0IDQgMCAwIDAtNC00SDlhNCA0IDAgMCAwLTQgNHYyIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PC9zdmc+';
                target.className = 'w-12 h-12 rounded-lg p-2 bg-[#eaf4f4] text-[#2d7d7d]';
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#eaf4f4] flex items-center justify-center">
              <User className="w-6 h-6 text-[#2d7d7d]" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center space-x-1">
              <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
              {profileUrl && (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2d7d7d] hover:text-[#1f5c5c] flex-shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-gray-600 truncate">{affiliation}</p>
            <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
              <span>{citations.toLocaleString()} citations</span>
              <span className="text-gray-300">•</span>
              <span>h-index: {hIndex}</span>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => setShowPapers(!showPapers)}
                className="flex items-center space-x-1 text-[#2d7d7d] hover:text-[#1f5c5c]"
              >
                <BookOpen className="h-3 w-3" />
                <span>{sharedPublications} shared papers</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {showPapers && sharedPapers.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-3">
          <ul className="space-y-2">
            {sharedPapers.map((paper, index) => (
              <li key={index} className="text-xs text-gray-600 hover:text-gray-900">
                <a href={paper.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {paper.title} ({paper.year}) - {paper.citations} citations
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}