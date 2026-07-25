"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus, Send, X } from "lucide-react";
import type { CommentRecord } from "@/types";

export function CommentsPanel({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch(`/api/comments?entityType=report&entityId=${encodeURIComponent(reportId)}`).then(async (response) => {
      if (response.ok) setComments((await response.json() as { comments: CommentRecord[] }).comments);
    });
  }, [open, reportId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityType: "report", entityId: reportId, body }) });
    if (response.ok) {
      const comment = (await response.json() as { comment: CommentRecord }).comment;
      setComments((current) => [comment, ...current]); setBody("");
    }
  }

  return <>
    <button className="button" onClick={() => setOpen((value) => !value)}><MessageSquarePlus size={15} /> Comments</button>
    {open && <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-header"><div><h3>Report comments</h3><p>Operational context is retained in the audit history.</p></div><button className="icon-button" onClick={() => setOpen(false)}><X size={15} /></button></div>
      <form className="form-stack" onSubmit={submit}><label>Add comment<textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={2} maxLength={2_000} required /></label><button className="button primary" type="submit"><Send size={14} /> Post comment</button></form>
      <div>{comments.map((comment) => <div className="alert-row" key={comment.id}><span className="avatar">{comment.userDisplayName[0]}</span><div><h3>{comment.userDisplayName}</h3><p>{comment.body}</p><small>{new Date(comment.createdAt).toLocaleString()}</small></div></div>)}{comments.length === 0 && <p className="muted">No comments yet.</p>}</div>
    </div>}
  </>;
}
