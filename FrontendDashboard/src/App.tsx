import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import ConfirmationsPage from "./pages/ConfirmationsPage"
import TasksPage from "./pages/TasksPage"
import ScheduledEventsPage from "./pages/ScheduledEventsPage"
import { AnimatePresence } from "framer-motion"

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-poppins">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white bg-opacity-50 p-6">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<ConfirmationsPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/scheduled-events" element={<ScheduledEventsPage />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App

