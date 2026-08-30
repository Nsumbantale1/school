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
}: {
  courseId: number;
  subjectId: number;
}) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("courseId", String(courseId));
    formData.set("subjectId", String(subjectId));
    const result = await createCourseNotice(formData);
    setPending(false);
    if (result.success) {
      toast.success("Notice published.");
      e.currentTarget.reset();
    } else {
      toast.error(result.error ?? "Failed to publish notice.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
          <Select name="category" defaultValue="general">
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
          <Select name="priority" defaultValue="normal">
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
            placeholder="Write the notice details here..."
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="expiresAt">Expires on (optional)</Label>
          <Input id="expiresAt" name="expiresAt" type="date" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="attachment">Attachment (optional)</Label>
          <Input
            id="attachment"
            name="attachment"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input id="isPinned" name="isPinned" type="checkbox" className="rounded" />
          <Label htmlFor="isPinned" className="font-normal cursor-pointer">
            Pin this notice to the top
          </Label>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Publish Notice
      </Button>
    </form>
  );
}
