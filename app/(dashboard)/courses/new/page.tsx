import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { CourseForm } from "../_components/course-form";

export default function NewCoursePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Add Course" description="Create a new training course">
        <BackButton fallbackHref="/courses" />
      </PageHeader>
      <CourseForm />
    </div>
  );
}
