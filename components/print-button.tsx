"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PrintButtonProps {
  title?: string;
}

export function PrintButton({ title }: PrintButtonProps) {
  function handlePrint() {
    if (title) {
      const original = document.title;
      document.title = title;
      window.print();
      document.title = original;
    } else {
      window.print();
    }
  }

  return (
    <Button variant="outline" onClick={handlePrint} className="print:hidden">
      <Printer className="mr-2 h-4 w-4" />
      Print
    </Button>
  );
}
