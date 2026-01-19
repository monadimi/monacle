import { Slide, SlideElement } from './types';

export const SLIDE_TEMPLATES: { name: string, label: string, generate: () => Partial<Slide> }[] = [
    {
        name: 'blank',
        label: 'Blank',
        generate: () => ({
            elements: [],
            background: { type: 'solid', value: '#ffffff' }
        })
    },
    {
        name: 'title',
        label: 'Title Slide',
        generate: () => ({
            background: { type: 'gradient', value: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' },
            elements: [
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: 100, y: 150, w: 600, h: 80,
                    content: 'Presentation Title',
                    style: { fontSize: 48, fontWeight: '900', color: '#ffffff', textAlign: 'center', fontFamily: 'Inter' }
                },
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: 150, y: 240, w: 500, h: 40,
                    content: 'Subtitle or Author Name',
                    style: { fontSize: 24, fontWeight: '400', color: '#94a3b8', textAlign: 'center', fontFamily: 'Inter' }
                }
            ]
        })
    },
    {
        name: 'content',
        label: 'Title & Body',
        generate: () => ({
            background: { type: 'solid', value: '#ffffff' },
            elements: [
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: 50, y: 40, w: 700, h: 60,
                    content: 'Slide Title',
                    style: { fontSize: 36, fontWeight: '700', color: '#0f172a', fontFamily: 'Inter' }
                },
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: 50, y: 120, w: 700, h: 300,
                    content: '• First point\n\n• Second point\n\n• Third point',
                    style: { fontSize: 18, fontWeight: '400', color: '#334155', fontFamily: 'Inter', textAlign: 'left' }
                }
            ]
        })
    },
    {
        name: 'split',
        label: 'Two Column',
        generate: () => ({
            background: { type: 'solid', value: '#ffffff' },
            elements: [
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: 50, y: 40, w: 700, h: 60,
                    content: 'Comparison',
                    style: { fontSize: 36, fontWeight: '700', color: '#0f172a', fontFamily: 'Inter' }
                },
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: 50, y: 120, w: 340, h: 300,
                    content: 'Left Side Content',
                    style: { fontSize: 18, color: '#334155', backgroundColor: '#f8fafc', borderRadius: '8px', fontFamily: 'Inter' }
                },
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: 410, y: 120, w: 340, h: 300,
                    content: 'Right Side Content',
                    style: { fontSize: 18, color: '#334155', backgroundColor: '#f8fafc', borderRadius: '8px', fontFamily: 'Inter' }
                }
            ]
        })
    },
    {
        name: 'big-number',
        label: 'Big Number',
        generate: () => ({
            background: { type: 'solid', value: '#000000' },
            elements: [
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: 100, y: 100, w: 600, h: 150,
                    content: '85%',
                    style: { fontSize: 120, fontWeight: '900', color: '#22c55e', textAlign: 'center', fontFamily: 'JetBrains Mono' },
                    animation: { type: 'pop', duration: 0.8, delay: 0.2 }
                },
                {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: 150, y: 260, w: 500, h: 40,
                    content: 'Growth Year over Year',
                    style: { fontSize: 24, fontWeight: '500', color: '#ffffff', textAlign: 'center', fontFamily: 'Inter' },
                    animation: { type: 'fade-in', duration: 1, delay: 0.8 }
                }
            ]
        })
    }
];
