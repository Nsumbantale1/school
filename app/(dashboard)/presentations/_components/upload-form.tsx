"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { uploadPresentation } from "../actions";
import type { PresentationCategory } from "@/lib/utils/presentations";

export function PresentationUploadForm({
  defaultCategory,
}: {
  defaultCategory: PresentationCategory;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState<PresentationCategory>(defaultCategory);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("category", category);
    const result = await uploadPresentation(formData);
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Upload failed.");
      return;
    }
    toast.success("Presentation archived.");
    e.currentTarget.reset();
    setCategory(defaultCategory);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            placeholder="e.g. Fire Discipline — ROGC Module 3"
          />
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as PresentationCategory)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="officers">Officer Courses</SelectItem>
              <SelectItem value="other_ranks">Other Ranks</SelectItem>
              <SelectItem value="external">External Briefs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="presentedAt">Date presented</Label>
          <Input id="presentedAt" name="presentedAt" type="date" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="presenterName">Presenter</Label>
          <Input
            id="presenterName"
            name="presenterName"
            placeholder="Rank & name"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audience">Audience</Label>
          <Input
            id="audience"
            name="audience"
            placeholder="Course / unit / host"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="venue">Venue</Label>
          <Input
            id="venue"
            name="venue"
            placeholder={
              category === "external"
                ? "External location / formation"
                : "SOFA classroom / hall"
            }
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="description">Notes</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            placeholder="Optional summary or keywords…"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="file">File (PDF / PowerPoint / Word — max 50 MB)</Label>
          <Input
            id="file"
            name="file"
            type="file"
            required
            accept=".pdf,.ppt,.pptx,.doc,.docx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Archive presentation
      </Button>
    </form>
  );
}
