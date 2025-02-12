import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const priorityColors = {
  High: "bg-red-500",
  Medium: "bg-yellow-500",
  Low: "bg-green-500",
};

const sectionColors = {
  pending: "bg-orange-100 border-purple-300",
  working: "bg-yellow-100 border-purple-300",
  completed: "bg-green-100 border-purple-300",
};

const TasksPage = () => {
  const [tasks, setTasks] = useState({ pending: [], working: [], completed: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch("https://spitnotionagent.onrender.com/tasks");
        const data = await response.json();
        if (data.status === "success") {
          setTasks(data.tasks);
        }
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 p-6 bg-gray-100 min-h-screen"
    >
      <h1 className="text-4xl font-extrabold text-purple-700 text-center">Tasks Dashboard</h1>
      <a
        href="https://www.notion.so"
        target="_blank"
        rel="noopener noreferrer"
        className="text-white bg-purple-600 hover:bg-purple-800 px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition duration-200 w-64 mx-auto"
      >
        <ExternalLink size={20} />
        <span>Access Tasks in Notion</span>
      </a>

      {loading ? (
        <p className="text-center text-purple-900 text-xl">Loading tasks...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(tasks).map(([status, taskList], index) => (
            <motion.div
              key={status}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 * (index + 1) }}
              className={`shadow-2xl rounded-xl p-6 border ${sectionColors[status]}`}
            >
              <h2 className={`text-2xl font-semibold mb-4 text-black-700 capitalize`}>{status}</h2>
              {taskList.length > 0 ? (
                <ul className="space-y-3">
                  {taskList.map((task) => (
                    <li key={task.id} className="p-4 border rounded-lg shadow-md bg-white hover:bg-gray-200 transition">
                      <p className="font-bold text-lg text-black">{task.title}</p>
                      <p className="text-sm font-medium text-gray-700">Assigned to: <span className="font-semibold text-purple-800">{task.assignedTo || "Unassigned"}</span></p>
                      {task.dueDate && (
                        <p className="text-xs font-medium text-gray-500">Due: <span className="font-bold text-red-600">{new Date(task.dueDate).toLocaleDateString()}</span></p>
                      )}
                      {task.priority && (
                        <span
                          className={`inline-block px-3 py-1 mt-2 text-white text-xs font-semibold rounded-full ${
                            priorityColors[task.priority] || "bg-gray-500"
                          }`}
                        >
                          {task.priority} Priority
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">No {status} tasks</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default TasksPage;
