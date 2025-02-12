import { Bell, Settings } from "lucide-react"
import { motion } from "framer-motion"

const Header = () => {
  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white shadow-md py-4 px-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black">AI Agent Dashboard</h1>
        <div className="flex items-center space-x-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="text-gray-600 hover:text-black transition duration-200"
          >
            <Bell size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="text-gray-600 hover:text-black transition duration-200"
          >
            <Settings size={20} />
          </motion.button>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">John Doe</span>
            <motion.img
              whileHover={{ scale: 1.1 }}
              className="h-8 w-8 rounded-full border-2 border-indigo-500"
              src="https://via.placeholder.com/40"
              alt="User profile"
            />
          </div>
        </div>
      </div>
    </motion.header>
  )
}

export default Header

