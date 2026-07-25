import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useContactMessages, useMarkMessageRead, useDeleteMessage } from '../../../hooks/useContactMessages.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';

export default function ContactMessageList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: messages, isLoading } = useContactMessages();
  const markMessageRead = useMarkMessageRead();
  const deleteMessage = useDeleteMessage();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function toggleRead(message) {
    try {
      await markMessageRead.mutateAsync({ id: message.id, isRead: !message.is_read });
    } catch (err) {
      toast.error(err.message || 'Failed to update message.');
    }
  }

  async function confirmDelete() {
    try {
      await deleteMessage.mutateAsync(pendingDeleteId);
      toast.success('Message deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete message.');
    } finally {
      setPendingDeleteId(null);
    }
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Contact Messages</h1>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {messages?.map((message) => (
              <tr key={message.id} className={message.is_read ? '' : 'bg-blue-50/40'}>
                <td className="px-4 py-3 font-medium text-slate-800">{message.name}</td>
                <td className="px-4 py-3 text-slate-600">{message.phone || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{message.email || '-'}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{message.message}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(message.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      message.is_read ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {message.is_read ? 'Read' : 'Unread'}
                  </span>
                </td>
                <td className="space-x-3 px-4 py-3">
                  <button onClick={() => toggleRead(message)} className="text-blue-600 hover:underline">
                    {message.is_read ? 'Mark Unread' : 'Mark Read'}
                  </button>
                  {isAdmin && (
                    <button onClick={() => setPendingDeleteId(message.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {messages?.length === 0 && <p className="p-6 text-center text-slate-500">No messages yet.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Message"
        message="Are you sure you want to delete this message? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
