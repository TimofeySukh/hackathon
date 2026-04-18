import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

function App() {
  return (
    <main className="app-shell">
      <Tldraw persistenceKey="hackathon-board" />
    </main>
  )
}

export default App
