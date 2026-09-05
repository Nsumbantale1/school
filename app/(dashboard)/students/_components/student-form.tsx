"use client";

import * as React from "react";
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
import { createStudent, updateStudent } from "../actions";

interface StudentFormProps {
  initialData?: {
    armyNumber: string;
    fullName: string;
    rank: string;
    gender: string;
    dateOfBirth: string | null;
    unit: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    photoPath?: string | null;
  };
}

const RANKS = [
  "Private",
  "Private First Class",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Sergeant First Class",
  "Master Sergeant",
  "First Sergeant",
  "Sergeant Major",
  "Second Lieutenant",
  "First Lieutenant",
  "Captain",
  "Major",
  "Lieutenant Colonel",
  "Colonel",
  "Brigadier General",
  "Major General",
  "Lieutenant General",
  "General",
];

export function StudentForm({ initialData }: StudentFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const isEditing = !!initialData;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);

    const result = isEditing
      ? await updateStudent(initialData.armyNumber, formData)
      : await createStudent(formData);

    setPending(false);

    if (result.success) {
      toast.success(isEditing ? "Student updated." : "Student created.");
      router.push("/students");
    } else {
      toast.error(result.error ?? "An error occurred.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="armyNumber">Army Number</Label>
        <Input
          id="armyNumber"
          name="armyNumber"
          required
          disabled={isEditing}
          placeholder="e.g., 12345678"
          defaultValue={initialData?.armyNumber ?? ""}
        />
        <p className="text-sm text-muted-foreground">
          Unique military identification number
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          name="fullName"
          required
          placeholder="e.g., John Doe"
          defaultValue={initialData?.fullName ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rank">Rank</Label>
          <Select name="rank" defaultValue={initialData?.rank ?? ""}>
            <SelectTrigger id="rank">
              <SelectValue placeholder="Select rank" />
            </SelectTrigger>
            <SelectContent>
              {RANKS.map((rank) => (
                <SelectItem key={rank} value={rank}>
                  {rank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select name="gender" defaultValue={initialData?.gender ?? "male"}>
            <SelectTrigger id="gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of Birth</Label>
        <Input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          defaultValue={initialData?.dateOfBirth ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unit">Unit</Label>
        <Input
          id="unit"
          name="unit"
          placeholder="e.g., 1st Infantry Battalion"
          defaultValue={initialData?.unit ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="e.g., +255 123 456 789"
            defaultValue={initialData?.phone ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="e.g., john.doe@example.com"
            defaultValue={initialData?.email ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="photo">Photograph</Label>
        {initialData?.photoPath && (
          <img
            src={initialData.photoPath}
            alt={initialData.fullName}
            className="h-28 w-24 rounded-md object-cover border"
          />
        )}
        <Input
          id="photo"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
        />
        <p className="text-sm text-muted-foreground">
          Optional portrait for the final course report (PNG, JPEG, or WebP).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Additional notes about this student..."
          defaultValue={initialData?.notes ?? ""}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : isEditing ? "Update Student" : "Create Student"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
