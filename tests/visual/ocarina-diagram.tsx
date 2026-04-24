import { createRoot } from 'react-dom/client'
import {
  OcarinaDiagram,
  type OcarinaHoleId,
} from '../../src/components/OcarinaDiagram/OcarinaDiagram'
import { ocarinaHoleIds } from '../../src/components/OcarinaDiagram/OcarinaDiagram.constants'
import './visual-fixture.css'

type VisualCase = {
  name: string
  title: string
  filledHoles: readonly OcarinaHoleId[]
}

const visualCases: readonly VisualCase[] = [
  {
    name: 'empty',
    title: 'No holes filled',
    filledHoles: [],
  },
  ...ocarinaHoleIds.map((holeId) => ({
    name: holeId,
    title: `${holeId} filled`,
    filledHoles: [holeId],
  })),
  {
    name: 'all-filled',
    title: 'All holes filled',
    filledHoles: ocarinaHoleIds,
  },
]

export function VisualFixture() {
  return (
    <main className="visual-fixture">
      {visualCases.map((visualCase) => (
        <section className="visual-case" key={visualCase.name}>
          <h1>{visualCase.title}</h1>
          <div
            className="visual-case__canvas"
            data-testid={`ocarina-${visualCase.name}`}
          >
            <OcarinaDiagram
              filledHoles={visualCase.filledHoles}
              title={visualCase.title}
            />
          </div>
        </section>
      ))}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<VisualFixture />)
