import { describe, test, expect } from 'vitest'
import * as ui from '.'

describe('the ui barrel (spec §3.7)', () => {
    test('exports every design-system component and helper under its contract name', () => {
        const names = [
            'Button', 'IconButton', 'Chip', 'Tag', 'Panel', 'ListRow', 'Segmented', 'Input', 'Select', 'Switch', 'Sheet',
            'Toast', 'Toaster', 'showToast', 'Banner', 'Loader', 'EmptyState', 'ErrorState', 'Avatar', 'Pager',
            'PlayingCard', 'intendedCardWidth', 'crispCardWidth', 'PixelIcon', 'SuitIcon',
        ]
        for (const name of names) expect(typeof (ui as Record<string, unknown>)[name], name).toBe('function')
        expect(ui.TOAST_MS).toBe(1800)
        expect(Object.keys(ui.ICONS)).toContain('crown')
    })
})
