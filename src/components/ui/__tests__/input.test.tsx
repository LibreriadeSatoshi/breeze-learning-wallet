import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";

describe("Input", () => {
  it("should render with its associated label and allow typing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input label="Username" onChange={handleChange} />);

    const input = screen.getByRole("textbox", { name: /username/i });
    
    await user.type(input, "John");

    expect(handleChange).toHaveBeenCalledTimes(4);
    expect(input).toHaveValue("John");
  });

  it("should render correctly when no label is provided", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    
    expect(input).not.toHaveAccessibleName();

    await user.type(input, "John");

    expect(handleChange).toHaveBeenCalledTimes(4);
    expect(input).toHaveValue("John");
  });

  it("show error message", async () => {
    render(<Input label="Email" error="invalid input" />);

    const input = screen.getByRole("textbox", { name: /email/i })
    const errorMessage = screen.getByText("invalid input");

    expect(input).toBeInvalid()
    expect(errorMessage).toHaveAttribute("id")
    expect(input).toHaveAttribute("aria-describedby", errorMessage.id);
  });

  it("show helper text", async () => {
    render(<Input label="Email" helperText="helper text" />);

    const input = screen.getByRole("textbox", { name: /email/i })
    const helperText = screen.getByText("helper text");

    expect(helperText).toHaveAttribute("id")
    expect(input).toHaveAttribute("aria-describedby", helperText.id);
  });

  it("should prioritize error message over helper text", async () => {
    render(<Input label="Email" error="invalid input" helperText="helper text" />);

    const input = screen.getByRole("textbox", { name: /email/i })
    const errorMessage = screen.getByText("invalid input");
    const helperText = screen.queryByText("helper text");

    expect(input).toBeInvalid()
    expect(errorMessage).toHaveAttribute("id")
    expect(input).toHaveAttribute("aria-describedby", errorMessage.id);
    expect(helperText).not.toBeInTheDocument();
  });

  it("should render a custom element", async () => {
    const ok = <p>ok</p>
    render(<Input label="Email" inputType="element" element={ok}/>);

    const input = screen.queryByRole("textbox");

    const custom_input = screen.getByText(/email/i)
    const element = screen.getByText("ok");

    expect(input).not.toBeInTheDocument();
    expect(custom_input).toBeInTheDocument();
    expect(element).toBeInTheDocument();
  });
});