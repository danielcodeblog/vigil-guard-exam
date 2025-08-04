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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">Student Name</th>
              <th className="border px-4 py-2">Exam Date</th>
              <th className="border px-4 py-2">Audio Recording</th>
              <th className="border px-4 py-2">Video</th>
              <th className="border px-4 py-2">Answers</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td className="border px-4 py-2">{record.studentName}</td>
                <td className="border px-4 py-2">{record.examDate}</td>
                <td className="border px-4 py-2">
                  {record.audioUrl ? (
                    <audio controls src={record.audioUrl} />
                  ) : (
                    <span>N/A</span>
                  )}
                </td>
                <td className="border px-4 py-2">
                  {record.videoUrl ? (
                    <video controls width="200" src={record.videoUrl} />
                  ) : (
                    <span>N/A</span>
                  )}
                </td>
                <td className="border px-4 py-2">{record.answers || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};


export default AdminPage;
