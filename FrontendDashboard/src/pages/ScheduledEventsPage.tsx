"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import moment from "moment-timezone";

interface ScheduledEvent {
  id: string;
  title: string;
  start: string; // ISO string
  end: string;   // ISO string
}

interface FreeSlot {
  start: string; // ISO string
  end: string;   // ISO string
}

interface TodaySchedule {
  scheduledEvents: ScheduledEvent[];
  freeSlots: FreeSlot[];
}

const ScheduledEventsPage = () => {
  const [todaySchedule, setTodaySchedule] = useState<TodaySchedule | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch today's schedule from your backend.
  useEffect(() => {
    const fetchTodaySchedule = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:3000/api/todaySchedule");
        if (!res.ok) {
          throw new Error("Failed to fetch today's schedule");
        }
        const data: TodaySchedule = await res.json();
        setTodaySchedule(data);
      } catch (error) {
        console.error("Error fetching today's schedule:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodaySchedule();
  }, []);

  // Helper to format a time range.
  const formatTimeRange = (startIso: string, endIso: string) => {
    const startTime = moment.tz(startIso, "Asia/Kolkata");
    const endTime = moment.tz(endIso, "Asia/Kolkata");
    return `${startTime.format("hh:mm A")} - ${endTime.format("hh:mm A")}`;
  };

  // Helper to format the date (from a given ISO string).
  const formatDate = (isoString: string) => {
    return moment.tz(isoString, "Asia/Kolkata").format("DD MMM YYYY");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto p-6 space-y-6"
    >
      <h1 className="text-3xl font-bold text-black">Today's Schedule</h1>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : todaySchedule ? (
        <>
          <motion.div
            className="bg-white shadow-lg rounded-lg p-6 border border-indigo-200"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-xl font-semibold mb-4 text-black">Today's Timeline (9 AM - 5 PM)</h2>
            {todaySchedule.scheduledEvents.length === 0 ? (
              <p className="text-gray-600">No events scheduled for today.</p>
            ) : (
              <motion.div
                className="space-y-4"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
                }}
              >
                {todaySchedule.scheduledEvents.map((event) => (
                  <motion.div
                    key={event.id}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    className="p-4 rounded-lg bg-white border border-indigo-200"
                  >
                    <h3 className="font-semibold text-indigo-800">{event.title}</h3>
                    <p className="text-sm text-gray-600 flex items-center space-x-1">
                      <Calendar size={14} />
                      <span>{formatTimeRange(event.start, event.end)}</span>
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(event.start)}</p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>

          <motion.div
            className="bg-white shadow-lg rounded-lg p-6 border border-indigo-200"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="font-semibold mb-2 text-black">Available Time Slots</h3>
            {todaySchedule.freeSlots.length === 0 ? (
              <p className="text-gray-600">No free slots available.</p>
            ) : (
              <ul className="space-y-1">
                {todaySchedule.freeSlots.map((slot, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center space-x-2 text-gray-700"
                  >
                    <Calendar size={14} className="text-green-500" />
                    <span>{formatTimeRange(slot.start, slot.end)}</span>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        </>
      ) : (
        <p className="text-gray-600">Unable to load schedule.</p>
      )}
    </motion.div>
  );
};

export default ScheduledEventsPage;
