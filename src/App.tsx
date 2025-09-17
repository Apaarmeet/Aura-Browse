import { type JSX } from 'react'
import VoiceAssistant from './components/VoiceAssistant'

function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50">
      <VoiceAssistant />
    </div>
  )
}

export default App