import { describe, it, expect } from 'vitest';
import { parseBibtex, getPublished, getPreprints, formatAuthors } from '../bibtex';

const sampleBib = `
@article{martiniani2017edwards,
  title={Numerical test of the {Edwards} conjecture shows that all packings become equally probable at jamming},
  author={Martiniani, S. and Schrenk, K.J. and Ramola, K. and Chakraborty, B. and Frenkel, D.},
  journal={Nature Physics},
  volume={13},
  pages={848--851},
  year={2017},
  doi={10.1038/nphys4168},
  note={Cover article},
  sortkey={10}
}

@article{ro2022entropy,
  title={Model-Free Measurement of Local Entropy Production and Extractable Work in Active Matter},
  author={Ro, S. and Guo, B. and Shih, A. and Peshkov, A. and Martiniani, S.},
  journal={Phys. Rev. Lett.},
  volume={129},
  pages={220601},
  year={2022},
  doi={10.1103/PhysRevLett.129.220601},
  note={Cover + Editor's Suggestion}
}

@unpublished{sharma2026xvwm,
  title={Cross-View World Models},
  author={Sharma, R. and Hogervorst, G. and Mackey, W.E. and Heeger, D.J. and Martiniani, S.},
  eprint={2602.07277},
  year={2026}
}

@article{hoellmer2025omatg,
  title={Open Materials Generation with Stochastic Interpolants},
  author={Hoellmer, P. and Egg, T. and Martirossyan, M.M. and Martiniani, S.},
  journal={Proc. 42nd Int. Conf. Mach. Learn. (ICML), PMLR 267},
  year={2025}
}
`;

describe('parseBibtex', () => {
  it('parses entries correctly', () => {
    const pubs = parseBibtex(sampleBib);
    expect(pubs).toHaveLength(4);
  });

  it('sorts by year descending', () => {
    const pubs = parseBibtex(sampleBib);
    const years = pubs.map(p => p.year);
    expect(years).toEqual([2026, 2025, 2022, 2017]);
  });

  it('cleans LaTeX markup from titles', () => {
    const pubs = parseBibtex(sampleBib);
    const edwards = pubs.find(p => p.key === 'martiniani2017edwards');
    expect(edwards?.title).toContain('Edwards');
    expect(edwards?.title).not.toContain('{');
  });

  it('extracts DOI', () => {
    const pubs = parseBibtex(sampleBib);
    const edwards = pubs.find(p => p.key === 'martiniani2017edwards');
    expect(edwards?.doi).toBe('10.1038/nphys4168');
  });

  it('extracts note field', () => {
    const pubs = parseBibtex(sampleBib);
    const prl = pubs.find(p => p.key === 'ro2022entropy');
    expect(prl?.note).toBe("Cover + Editor's Suggestion");
  });

  it('identifies preprints from unpublished type', () => {
    const pubs = parseBibtex(sampleBib);
    const xvwm = pubs.find(p => p.key === 'sharma2026xvwm');
    expect(xvwm?.isPreprint).toBe(true);
  });

  it('identifies published papers', () => {
    const pubs = parseBibtex(sampleBib);
    const omatg = pubs.find(p => p.key === 'hoellmer2025omatg');
    expect(omatg?.isPreprint).toBe(false);
  });

  it('extracts arxiv eprint', () => {
    const pubs = parseBibtex(sampleBib);
    const xvwm = pubs.find(p => p.key === 'sharma2026xvwm');
    expect(xvwm?.arxiv).toBe('2602.07277');
  });
});

describe('getPublished / getPreprints', () => {
  it('separates published from preprints', () => {
    const pubs = parseBibtex(sampleBib);
    expect(getPublished(pubs)).toHaveLength(3);
    expect(getPreprints(pubs)).toHaveLength(1);
  });
});

describe('formatAuthors', () => {
  it('joins authors with commas', () => {
    const result = formatAuthors('Martiniani, S. and Frenkel, D.');
    expect(result).toBe('Martiniani, S., Frenkel, D.');
  });

  it('truncates long author lists', () => {
    const authors = Array.from({ length: 25 }, (_, i) => `Author${i}`).join(' and ');
    const result = formatAuthors(authors, 3);
    expect(result).toContain('et al.');
    expect(result.split(',').length).toBeLessThan(10);
  });
});
