import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ExamRecord = {
  id: string;
  studentName: string;
  examDate: string;
  audioUrl?: string;
  videoUrl?: string;
  answers?: string;
};

const AdminPage: React.FC = () => {
  const [records, setRecords] = useState<ExamRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      // Fetch exam_sessions and join with user info (assuming user table exists)
      // Also fetch audio/video/answers if stored in exam_sessions or related table
      const { data: sessions, error } = await supabase
        .from("exam_sessions")
        .select(`id, created_at, user_id, started_at, ended_at, status, violations, audio_url, video_url, answers, users (name)`);

      if (error) {
        setLoading(false);
        return;
      }

      // Map data to ExamRecord type
      const mapped = (sessions || []).map((session: any) => ({
        id: session.id,
        studentName: session.users?.name || session.user_id,
        examDate: session.started_at || session.created_at,
        audioUrl: session.audio_url,
        videoUrl: session.video_url,
        answers: session.answers,
      }));
      setRecords(mapped);
      setLoading(false);
    };
    fetchRecords();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-cyan-100 to-indigo-200 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-600 drop-shadow-lg mb-2">Admin Dashboard</h1>
          <p className="text-lg text-blue-900/80 font-medium tracking-wide">Review all exam sessions, recordings, and answers</p>
        </div>
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-blue-200 p-8">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <span className="text-lg text-blue-700 animate-pulse">Loading...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left rounded-xl overflow-hidden shadow-lg">
                <thead className="bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 text-white">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Student Name</th>
                    <th className="px-6 py-4 font-semibold">Exam Date</th>
                    <th className="px-6 py-4 font-semibold">Audio</th>
                    <th className="px-6 py-4 font-semibold">Video</th>
                    <th className="px-6 py-4 font-semibold">Answers</th>
                  </tr>
                </thead>
                <tbody className="bg-white/90 divide-y divide-blue-100">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-blue-50 transition">
                      <td className="px-6 py-4 text-blue-900 font-medium">{record.studentName}</td>
                      <td className="px-6 py-4 text-blue-700">{record.examDate}</td>
                      <td className="px-6 py-4">
                        {record.audioUrl ? (
                          <audio controls src={record.audioUrl} className="w-40" />
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {record.videoUrl ? (
                          <video controls width="180" className="rounded shadow" src={record.videoUrl} />
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="bg-blue-50 rounded p-2 text-blue-900 text-sm shadow-inner">
                          {record.answers || <span className="text-gray-400">N/A</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export default AdminPage;
