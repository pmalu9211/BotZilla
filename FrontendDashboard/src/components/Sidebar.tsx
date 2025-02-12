import { NavLink } from "react-router-dom"
import { Home, CheckSquare, Calendar } from "lucide-react"
import { motion } from "framer-motion"

const Sidebar = () => {
  return (
    <motion.aside
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white text-gray-800 w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform md:relative md:translate-x-0 transition duration-200 ease-in-out shadow-lg"
    >
      <nav>
        <h2 className="text-2xl font-bold text-center mb-6 text-black">AI Dashboard</h2>
        <ul className="space-y-2">
          {[
            { to: "/", icon: Home, label: "Confirmations" },
            { to: "/tasks", icon: CheckSquare, label: "Tasks" },
            { to: "/scheduled-events", icon: Calendar, label: "Scheduled Events" },
          ].map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-2 py-2.5 px-4 rounded transition duration-200 ${
                    isActive
                      ? "bg-indigo-500 text-white shadow-md"
                      : "text-gray-600 hover:bg-indigo-100 hover:text-black"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} />
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.div
                        className="absolute inset-y-0 left-0 w-1 bg-indigo-600 rounded-r-md"
                        layoutId="sidebar-indicator"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </motion.aside>
  )
}

export default Sidebar

