import { Document, Packer } from 'docx';
import type { Paragraph } from 'docx';
import { saveAs } from 'file-saver';
import type { Author, CoAuthorGeoData } from '../types/scholar';
import { fetchOrcidProfile } from '../services/orcid';
import { findOpenAlexAuthor } from '../services/openalex/author-lookup';
import { buildNwo } from './narrativeCv/nwo';
import { buildErc } from './narrativeCv/erc';
import { buildMsca } from './narrativeCv/msca';

// Entry point for the Word export, loaded on demand from NarrativeCvTab (docx is
// ~650KB). One builder per funder format lives in ./narrativeCv/.

export type NarrativeCvFormat = 'nwo' | 'erc' | 'msca';

export async function exportNarrativeCv(
  data: Author,
  format: NarrativeCvFormat,
  geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null
): Promise<void> {
  let resolvedOrcidId = data.openAccess?.orcid;
  if (!resolvedOrcidId) {
    const author = await findOpenAlexAuthor(data.name, data.affiliation);
    resolvedOrcidId = author?.orcid;
  }
  const orcid = resolvedOrcidId ? await fetchOrcidProfile(resolvedOrcidId) : null;

  const builders: Record<NarrativeCvFormat, () => Paragraph[]> = {
    nwo: () => buildNwo(data, orcid, resolvedOrcidId, geoData),
    erc: () => buildErc(data, orcid, resolvedOrcidId, geoData),
    msca: () => buildMsca(data, orcid, resolvedOrcidId, geoData),
  };

  const children = builders[format]();

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1100, bottom: 1100, left: 1200, right: 1200 } },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = data.name.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const prefixes: Record<NarrativeCvFormat, string> = { nwo: 'NWO_EBCV', erc: 'ERC_CV', msca: 'MSCA_CV' };
  saveAs(blob, `ScholarFolio_${prefixes[format]}_${safeName}_${dateStr}.docx`);
}
