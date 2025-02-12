import type React from "react"
import { Check, X } from "lucide-react"
import { motion } from "framer-motion"

interface CardProps {
  action: string
  onConfirm: () => void
  onReject: () => void
}

const Card: React.FC<CardProps> = ({ action, onConfirm, onReject }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 50 },
        visible: { opacity: 1, y: 0 },
      }}
      className="bg-white shadow-lg rounded-lg p-6 space-y-4 border border-indigo-200 hover:border-indigo-400 transition-colors duration-300"
    >
      <p className="text-gray-800">{action}</p>
      <div className="flex justify-end space-x-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onConfirm}
          className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition duration-200 flex items-center space-x-1 shadow-md"
        >
          <Check size={16} />
          <span>Accept</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReject}
          className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-200 flex items-center space-x-1 shadow-md"
        >
          <X size={16} />
          <span>Reject</span>
        </motion.button>
      </div>
    </motion.div>
  )
}

export default Card

