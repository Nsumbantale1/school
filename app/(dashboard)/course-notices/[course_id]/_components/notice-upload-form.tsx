"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { createCourseNotice } from "../../actions";

export function NoticeUploadForm({
  courseId,
  subjectId,
  subjects,
}: {
  courseId: number;
  subjectId?: number;
  subjects?: Array<{ subjectId: number; subjectName: string }>;
}) {
  const defaultSubject =
    subjectId != null
      ? String(subjectId)
      : subjects?.[0]
        ? String(subjects[0].subjectId)
        : "";

  const [pending, setPending] = useState(false);
  const [pickedSubject, setPickedSubject] = useState(defaultSubject);
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const needsSubjectPick = !subjectId && (subjects?.length ?? 0) > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("courseId", String(courseId));
    formData.set("category", category);
    formData.set("priority", priority);

    const sid = subjectId ?? parseInt(pickedSubject, 10);
    if (sid) formData.set("subjectId", String(sid));

    const result = await createCourseNotice(formData);
    setPending(false);
    if (result.success) {
      toast.success("Notice published.");
      e.currentTarget.reset();
      if (!subjectId) setPickedSubject(defaultSubject);
      setCategory("general");
      setPriority("normal");
    } else {
      toast.error(result.error ?? "Failed to publish notice.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {needsSubjectPick && (
          <div className="space-y-1 sm:col-span-2">
            <Label>Subject</Label>
            <Select value={pickedSubject} onValueChange={setPickedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects!.map((s) => (
                  <SelectItem key={s.subjectId} value={String(s.subjectId)}>
                    {s.subjectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="e.g. Range practice schedule change"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="schedule">Schedule</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="exam">Exam</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="priority">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="important">Important</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            name="body"
            rows={4}
            placeholder="Write the notice message…"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="expiresAt">Expires (optional)</Label>
          <Input id="expiresAt" name="expiresAt" type="datetime-local" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="attachment">Attachment / file upload</Label>
          <Input
            id="attachment"
            name="attachment"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
          />
          <p className="text-[11px] text-muted-foreground">
            PDF, Word, Excel, or image — max 10 MB
          </p>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="isPinned"
            name="isPinned"
            type="checkbox"
            className="rounded"
          />
          <Label htmlFor="isPinned" className="font-normal">
            Pin this notice
          </Label>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Publish notice
      </Button>
    </form>
  );
}
