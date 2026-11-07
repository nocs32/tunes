import { describe, expect, it } from 'vitest';
import { artistMatches, coreTitle, normalize, pickMatch, searchQueries } from './match.ts';

const result = (name: string, ...artists: string[]): { name: string; artists: { id: string; name: string }[] } => ({
  name,
  artists: artists.map((artist) => ({ id: artist, name: artist })),
});

describe('normalize', () => {
  it('ignores case, accents, punctuation and a leading "The"', () => {
    expect(normalize('The Beatles')).toBe('beatles');
    expect(normalize('Beyoncé')).toBe('beyonce');
    expect(normalize('Simon & Garfunkel')).toBe(normalize('Simon and Garfunkel'));
    expect(normalize('青い鳥')).toBe('青い鳥');
  });
});

describe('coreTitle', () => {
  it('drops version tags but keeps real bracketed words', () => {
    expect(coreTitle('Hey Jude - Remastered 2015')).toBe('hey jude');
    expect(coreTitle('Lose Control (feat. Someone)')).toBe('lose control');
    expect(coreTitle('SI AI AI - Speed Up')).toBe('si ai ai');
    expect(coreTitle("(Don't Fear) The Reaper")).toBe('don t fear the reaper');
    expect(coreTitle('春日影 (MyGO!!!!! ver.)')).toBe('春日影');
  });
});

describe('artistMatches', () => {
  it('needs the artist itself, not a cover act', () => {
    expect(artistMatches(['Bonobo'], [{ id: '1', name: 'Bonobo' }])).toBe(true);
    expect(artistMatches(['Bonobo'], [{ id: '2', name: 'Bonobo Tribute Band' }])).toBe(false);
  });

  it('accepts a collaboration when the lead artist is on the track', () => {
    expect(artistMatches(['NOVA & K4TE'], [{ id: '1', name: 'NOVA' }, { id: '2', name: 'K4TE' }])).toBe(true);
    expect(artistMatches(['Malcolm X'], [{ id: '1', name: 'Malcolm X' }])).toBe(true);
  });
});

describe('pickMatch', () => {
  it('prefers the original over other versions', () => {
    const results = [result('Kerala (Live)', 'Bonobo'), result('Kerala', 'Bonobo'), result('Kerala', 'Bonobo Tribute Band')];

    expect(pickMatch({ artist: 'Bonobo', title: 'Kerala' }, results)?.name).toBe('Kerala');
  });

  it('takes the exact version when Claude names one', () => {
    const results = [result('SI AI AI', 'BLOODTHXRN'), result('SI AI AI - Speed Up', 'BLOODTHXRN')];

    expect(pickMatch({ artist: 'BLOODTHXRN', title: 'SI AI AI - Speed Up' }, results)?.name).toBe('SI AI AI - Speed Up');
  });

  it('accepts another version when it is the only one', () => {
    expect(pickMatch({ artist: 'Bonobo', title: 'Kerala' }, [result('Kerala - Edit', 'Bonobo')])?.name).toBe('Kerala - Edit');
  });

  it('finds nothing when the song is not there', () => {
    expect(pickMatch({ artist: 'Bonobo', title: 'Made Up Song' }, [result('Kerala', 'Bonobo')])).toBeUndefined();
  });
});

describe('other spellings (Spotify shows some names romanized)', () => {
  it('accepts the artist under its alias when Spotify’s artist filter found it', () => {
    const wanted = { artist: '米津玄師', title: 'KICK BACK' };

    expect(pickMatch(wanted, [result('KICK BACK', 'Kenshi Yonezu')], true)?.name).toBe('KICK BACK');
    expect(pickMatch(wanted, [result('KICK BACK', 'Kenshi Yonezu')], false)).toBeUndefined();
  });

  it('matches a romanized title through title_alt', () => {
    const wanted = { artist: 'Eve', title: '廻廻奇譚', titleAlt: 'Kaikai Kitan' };
    const results = [result('abyss in the world', 'Eve'), result('Kaikai Kitan', 'Eve')];

    expect(pickMatch(wanted, results)?.name).toBe('Kaikai Kitan');
  });

  it('matches the alias given in artist_alt', () => {
    expect(pickMatch({ artist: '星街すいせい', artistAlt: 'Hoshimachi Suisei', title: 'ビビデバ' }, [result('ビビデバ', 'Hoshimachi Suisei')])?.name).toBe(
      'ビビデバ',
    );
  });
});

describe('searchQueries', () => {
  it('tries field filters first, then plain words, each with both spellings', () => {
    expect(searchQueries({ artist: 'Eve', title: '廻廻奇譚', titleAlt: 'Kaikai Kitan' }).map((query) => query.q)).toEqual([
      'track:"廻廻奇譚" artist:"Eve"',
      'track:"Kaikai Kitan" artist:"Eve"',
      '廻廻奇譚 Eve',
      'Kaikai Kitan Eve',
    ]);
  });

  it('does not repeat a query when there is no other spelling', () => {
    expect(searchQueries({ artist: 'NOVA & K4TE', title: 'NIGHT RUN - Slowed' })).toEqual([
      { q: 'track:"NIGHT RUN - Slowed" artist:"NOVA"', artistFiltered: true },
      { q: 'NIGHT RUN NOVA', artistFiltered: false },
    ]);
  });
});
