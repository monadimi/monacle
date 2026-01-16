import { Node, mergeAttributes } from '@tiptap/core'

export const Page = Node.create({
  name: 'page',
  group: 'page',
  content: 'block+',
  draggable: false,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="page"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page', class: 'a4-page' }), 0]
  },
})

export const CustomDoc = Node.create({
  name: 'doc',
  topNode: true,
  content: 'page+',
})
