import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white p-6">
        <h1 className="text-3xl font-bold">SimPatient</h1>
        <p className="mt-2">Build clinical confidence through realistic AI-powered consultations</p>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Built for First-Year Medical Students</h2>
          <p className="mb-6">
            SimPatient helps you practice real patient conversations—before you ever meet a real one. 
            Whether you're prepping for your first SP session or building empathy and structure in CSF1, 
            this platform gives you a safe space to learn and grow.
          </p>

          <div className="bg-gray-50 p-6 rounded-lg mb-8 shadow-sm">
            <h3 className="text-xl font-medium mb-3">Features</h3>
            <ul className="text-left space-y-2">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Practice interviewing a virtual patient in real-time</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Choose voice or keyboard input to match your style</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Get immediate feedback based on empathy and structure</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Present your findings to an AI attending</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Review your transcript and improve with each session</span>
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
        &copy; {new Date().getFullYear()} SimPatient
      </footer>
    </div>
  );
}
