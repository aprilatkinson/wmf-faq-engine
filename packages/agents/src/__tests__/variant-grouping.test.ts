import { describe, expect, it } from 'vitest';
import type { IntakeRow } from '../../../core/src/types/intake';
import { groupIntakeRows } from '../variant-grouping';

function row(id: string, url: string, product_family = 'Devil', product_id = id): IntakeRow {
  return {
    row_id: id,
    product_id,
    url,
    page_type: 'PDP',
    category: 'Cookware',
    product_family,
    priority: 'P2',
    source_language: 'de',
  };
}

describe('Variant grouping scaffold', () => {
  it('groups 20/24/28 cm same family pans together', () => {
    const result = groupIntakeRows([
      row('devil-20', 'https://example.com/devil-non-stick-frying-pan-20-cm'),
      row('devil-24', 'https://example.com/devil-non-stick-frying-pan-24-cm'),
      row('devil-28', 'https://example.com/devil-non-stick-frying-pan-28-cm'),
    ]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].requires_unique_generation).toBe(false);
    expect(result.groups[0].variant_urls).toHaveLength(3);
    expect(result.groups[0].variant_dimensions).toEqual(['20cm', '24cm', '28cm']);
  });

  it('does not group Devil ceramic and Devil PTFE/non-stick pans together', () => {
    const result = groupIntakeRows([
      row('devil-ceramic', 'https://example.com/devil-ceramic-frying-pan-28-cm'),
      row('devil-ptfe', 'https://example.com/devil-ptfe-non-stick-frying-pan-28-cm'),
    ]);

    expect(result.groups).toHaveLength(2);
  });

  it('does not group Profi and Profi Resist together', () => {
    const result = groupIntakeRows([
      row('profi', 'https://example.com/profi-stainless-steel-frying-pan-28-cm', 'Profi'),
      row('profi-resist', 'https://example.com/profi-resist-frying-pan-28-cm', 'Profi Resist'),
    ]);

    expect(result.groups).toHaveLength(2);
  });

  it('does not group wok and frying pan together', () => {
    const result = groupIntakeRows([
      row('wok', 'https://example.com/durado-wok-28-cm', 'Durado'),
      row('pan', 'https://example.com/durado-frying-pan-28-cm', 'Durado'),
    ]);

    expect(result.groups).toHaveLength(2);
  });

  it('does not group accessories with pans', () => {
    const result = groupIntakeRows([
      row('lid', 'https://example.com/devil-pan-lid-accessory-28-cm'),
      row('pan', 'https://example.com/devil-non-stick-frying-pan-28-cm'),
    ]);

    expect(result.groups).toHaveLength(2);
    expect(result.groups.some((group) => group.requires_unique_generation)).toBe(true);
  });

  it('groups Silit Belluna color variants', () => {
    const result = groupIntakeRows([
      row('belluna-rose', 'https://example.com/silit-belluna-stielpfanne-24-cm-rose', 'Silit Belluna'),
      row('belluna-blue', 'https://example.com/silit-belluna-stielpfanne-24-cm-blau', 'Silit Belluna'),
      row('belluna-green', 'https://example.com/silit-belluna-stielpfanne-24-cm-gruen', 'Silit Belluna'),
    ]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].requires_unique_generation).toBe(false);
    expect(result.groups[0].variant_dimensions).toEqual(expect.arrayContaining(['24cm', 'blau', 'gruen', 'rose']));
  });

  it('groups Silit Messino 20/24/28 cm variants', () => {
    const result = groupIntakeRows([
      row('messino-20', 'https://example.com/silit-messino-stielpfanne-20-cm', 'Silit Messino'),
      row('messino-24', 'https://example.com/silit-messino-stielpfanne-24-cm', 'Silit Messino'),
      row('messino-28', 'https://example.com/silit-messino-stielpfanne-28-cm', 'Silit Messino'),
    ]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].requires_unique_generation).toBe(false);
  });

  it('groups Fusiontec Mineral 20/24/28 cm variants', () => {
    const result = groupIntakeRows([
      row('fusiontec-20', 'https://example.com/fusiontec-mineral-stielpfanne-20-cm-platinum', 'Fusiontec Mineral'),
      row('fusiontec-24', 'https://example.com/fusiontec-mineral-stielpfanne-24-cm-platinum', 'Fusiontec Mineral'),
      row('fusiontec-28', 'https://example.com/fusiontec-mineral-stielpfanne-28-cm-platinum', 'Fusiontec Mineral'),
    ]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].requires_unique_generation).toBe(false);
  });

  it('does not group PermaDur Premium high-rim pan with regular pan', () => {
    const result = groupIntakeRows([
      row('permadur-regular', 'https://example.com/permadur-premium-stielpfanne-24-cm', 'PermaDur Premium'),
      row('permadur-high', 'https://example.com/permadur-premium-stielpfanne-hoch-24-cm', 'PermaDur Premium'),
    ]);

    expect(result.groups).toHaveLength(2);
  });

  it('groups set variants with included accessory differences for adaptation', () => {
    const result = groupIntakeRows([
      row('durado-set', 'https://example.com/durado-bratpfannen-set-2-teilig-24-und-28-cm', 'Durado'),
      row('durado-set-wender', 'https://example.com/durado-bratpfannen-set-2-teilig-24-und-28-cm-mit-pfannenwender', 'Durado'),
      row('durado-set-protector', 'https://example.com/durado-bratpfannen-set-2-teilig-24-und-28-cm-mit-pfannenschutzmatten', 'Durado'),
    ]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].requires_unique_generation).toBe(false);
    expect(result.groups[0].variant_dimensions).toEqual(expect.arrayContaining(['2teilig', 'with-protector', 'with-turner']));
  });

  it('keeps wok and serving pan separate from regular frying pan', () => {
    const result = groupIntakeRows([
      row('durado-pan', 'https://example.com/durado-stielpfanne-28-cm', 'Durado'),
      row('durado-wok', 'https://example.com/durado-wok-28-cm', 'Durado'),
      row('durado-serving', 'https://example.com/durado-servierpfanne-28-cm', 'Durado'),
    ]);

    expect(result.groups).toHaveLength(3);
  });

  it('reduces 300 near-duplicate size variant URLs below URL count', () => {
    const rows = Array.from({ length: 300 }, (_, index) => {
      const size = [20, 24, 28][index % 3];
      return row(`devil-${index + 1}`, `https://example.com/devil-non-stick-frying-pan-${size}-cm?variant=${index + 1}`);
    });
    const result = groupIntakeRows(rows);

    expect(result.groups.length).toBeLessThan(300);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].variant_urls).toHaveLength(300);
  });
});
