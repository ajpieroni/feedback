import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white p-6">
        <h1 className="text-3xl font-bold">Medical Interaction Simulator</h1>
        <p className="mt-2">Practice medical consultations with an AI patient</p>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Welcome to the Medical Interaction Simulator</h2>
          <p className="mb-6">
            This platform allows medical students and professionals to practice their consultation skills
            with an AI-powered virtual patient. Receive detailed feedback on your interpersonal skills
            and medical reasoning.
          </p>

          <div className="bg-gray-50 p-6 rounded-lg mb-8 shadow-sm">
            <h3 className="text-xl font-medium mb-3">Features</h3>
            <ul className="text-left space-y-2">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Real-time speech-to-text and text-to-speech interaction</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Support for both voice and keyboard input</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>AI-powered patient simulation</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>EPA (Entrustable Professional Activities) based feedback</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Conversation transcript saving</span>
              </li>
            </ul>
          </div>

          <Link 
            href="/simulator" 
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-md transition-colors"
          >
            Start Simulation
          </Link>
        </div>
      </main>

      <footer className="bg-gray-100 p-4 text-center text-gray-600 text-sm">
        &copy; {new Date().getFullYear()} Medical Interaction Simulator
      </footer>
    </div>
  );
}
