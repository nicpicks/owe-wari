// Kanji glyph shown on each expense's tile, per category (Izakaya design).
export const CATEGORY_GLYPHS: Record<string, string> = {
    Food: '食',
    Transport: '車',
    Stay: '宿',
    Groceries: '買',
    Activities: '遊',
    General: '般',
    Others: '他',
}

export const categoryGlyph = (category: string | null | undefined) =>
    CATEGORY_GLYPHS[category?.trim() ?? ''] ?? '費'
