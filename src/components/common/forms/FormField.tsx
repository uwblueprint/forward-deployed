import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  error?: string;
};

function FormField({ label, name, error, ...props }: FormFieldProps) {
  return (
    <>
      <Label htmlFor={name}>{label}</Label>
      <Input
        {...props}
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && <p id={`${name}-error`}>{error}</p>}
    </>
  );
}

export { FormField };
