"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import moment from "moment-timezone";

// Define the Confirmation interface based on our backend.
interface Confirmation {
  id: number;
  recipient_name: string;
  title: string;
  timing: string; // Stored as "YYYY-MM-DD HH:MM:SS" (in IST)
  status: string;
  json_string: string;
}

// A detailed Card component for displaying confirmation info.
interface CardProps {
  confirmation: Confirmation;
  onConfirm: () => void;
  onReject: () => void;
}

const Card = ({ confirmation, onConfirm, onReject }: CardProps) => {
  const eventData = JSON.parse(confirmation.json_string);

  // Format the start and end times.
  const formattedStart = moment(eventData.start).format("HH:mm");
  const formattedEnd = moment(eventData.end).format("HH:mm");

  // Format the date.
  const formattedDate = moment(eventData.date, "YYYY-MM-DD").format("DD MMM YYYY");

  // Calculate the meeting duration.
  const startTime = moment(eventData.start);
  const endTime = moment(eventData.end);
  const durationMinutes = endTime.diff(startTime, "minutes");
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const meetingDuration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <motion.div
      className="bg-white rounded-lg shadow-lg p-6 border border-gray-200"
      whileHover={{ scale: 1.02 }}
    >
      <h2 className="text-xl font-semibold mb-2">{confirmation.title}</h2>
      <p className="text-gray-700 mb-1">
        <strong>Recipient:</strong> {confirmation.recipient_name}
      </p>
      <p className="text-gray-700 mb-1">
        <strong>Date:</strong> {formattedDate}
      </p>
      <p className="text-gray-700 mb-1">
        <strong>Start Time (IST):</strong> {formattedStart}
      </p>
      <p className="text-gray-700 mb-1">
        <strong>End Time (IST):</strong> {formattedEnd}
      </p>
      <p className="text-gray-700 mb-4">
        <strong>Duration:</strong> {meetingDuration}
      </p>
      <p className="text-gray-600 text-sm mb-4">
        Status: <span className="uppercase">{confirmation.status}</span>
      </p>
      <div className="flex justify-end space-x-4">
        <button
          onClick={onReject}
          className="flex items-center bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 9l4-4a1 1 0 011.414 1.414L11.414 10l4 4a1 1 0 01-1.414 1.414L10 11.414l-4 4A1 1 0 014.586 14L8.586 10 4.586 6A1 1 0 015.414 4.586l4 4z"
              clipRule="evenodd"
            />
          </svg>
          Reject
        </button>
        <button
          onClick={onConfirm}
          className="flex items-center bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Confirm
        </button>
      </div>
    </motion.div>
  );
};


const ConfirmationsPage = () => {
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch confirmations from the backend.
  useEffect(() => {
    const fetchConfirmations = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:3005/confirmations");
        if (!res.ok) {
          throw new Error("Failed to fetch confirmations");
        }
        const data: Confirmation[] = await res.json();
        setConfirmations(data);
      } catch (err) {
        console.error("Error fetching confirmations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfirmations();
  }, []);

  // Update a confirmation and remove it from the list.
  const handleConfirmation = async (id: number, approved: boolean) => {
    const newStatus = approved ? "confirmed" : "rejected";
    
    // Optimistic update: Remove the confirmation immediately.
    setConfirmations((prev) => prev.filter((conf) => conf.id !== id));
    
    try {
      const res = await fetch(`http://localhost:3005/confirmations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        throw new Error("Failed to update confirmation");
      }
      const responseData = await res.json();
      console.log("Update response:", responseData);
    } catch (err) {
      console.error(`Error updating confirmation ${id}:`, err);
      // Optionally, re-add the confirmation to the state here if desired.
    }
  };

  return (
    <motion.div
      className="container mx-auto p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">
        Meeting Confirmations
      </h1>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : confirmations.length === 0 ? (
        <p className="text-center text-gray-600">
          No pending confirmations at the moment.
        </p>
      ) : (
        <motion.div
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
        >
          {confirmations.map((conf) => (
            <Card
              key={conf.id}
              confirmation={conf}
              onConfirm={() => handleConfirmation(conf.id, true)}
              onReject={() => handleConfirmation(conf.id, false)}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};

export default ConfirmationsPage;
