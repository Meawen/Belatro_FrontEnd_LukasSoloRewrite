import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { usePageTitle } from './usePageTitle'

function Titled({ title }: { title: string }) {
    usePageTitle(title)
    return null
}

describe('usePageTitle (X-16)', () => {
    test('the document is titled "{Page} · Stiglja" while the page shows, and "Stiglja" after', () => {
        const { rerender, unmount } = render(<Titled title="Rules" />)
        expect(document.title).toBe('Rules · Stiglja')
        rerender(<Titled title="Privacy notice" />)
        expect(document.title).toBe('Privacy notice · Stiglja')
        unmount()
        expect(document.title).toBe('Stiglja')
    })
})
