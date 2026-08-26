import { Modal } from "../modal";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("Modal", () => {
    it("should render a full modal", async () => {
        const handleClose = vi.fn();
        const modal_children = <p>test children</p>;

        render(<Modal open={true} onClose={handleClose} title="test" description="lorem ipsum dolor">{modal_children}</Modal>);

        const modal = screen.getByRole("dialog", { name: /test/i });
        const children = screen.getByText(/test children/i);

        expect(modal).toHaveAttribute("aria-modal", "true");
        expect(modal).toHaveAccessibleDescription("lorem ipsum dolor");
        expect(children).toBeVisible();
    });

    it("show a modal without description", async () => {
        const handleClose = vi.fn();
        const modal_children = <p>test children</p>;

        render(<Modal open={true} onClose={handleClose} title="test">{modal_children}</Modal>);

        const modal = screen.getByRole("dialog", { name: /test/i });
        const children = screen.getByText(/test children/i);

        expect(modal).toHaveAttribute("aria-modal", "true");
        expect(modal).not.toHaveAccessibleDescription();
        expect(children).toBeVisible();
    });

    it("should close the modal when clicking on the backdrop", async () => {
        const handleClose = vi.fn();
        const user = userEvent.setup();
        const modal_children = <p>test children</p>;

        render(
            <Modal open={true} onClose={handleClose} title="test">
                {modal_children}
            </Modal>
        );

        const modal = screen.getByRole("dialog", { name: /test/i });
        const children = screen.getByText(/test children/i);
        const backdrop = modal.parentElement!;

        expect(modal).toHaveAttribute("aria-modal", "true");
        expect(children).toBeVisible();

        await user.click(backdrop);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("should close the modal when keyboard escape is pressed", async () => {
        const handleClose = vi.fn();
        const user = userEvent.setup();
        const modal_children = <p>test children</p>;

        render(
            <Modal open={true} onClose={handleClose} title="test">
                {modal_children}
            </Modal>
        );

        const modal = screen.getByRole("dialog", { name: /test/i });
        const children = screen.getByText(/test children/i);

        expect(modal).toHaveAttribute("aria-modal", "true");
        expect(children).toBeVisible();

        await user.keyboard("[Escape]");

        expect(handleClose).toHaveBeenCalledTimes(1);
    });
    
    it("should not close the modal when clicking inside the modal content", async () => {
        const handleClose = vi.fn();
        const user = userEvent.setup();
        const modal_children = <p>test children</p>;

        render(
            <Modal open={true} onClose={handleClose} title="test">
                {modal_children}
            </Modal>
        );

        const modal = screen.getByRole("dialog", { name: /test/i });
        const children = screen.getByText(/test children/i);

        expect(modal).toHaveAttribute("aria-modal", "true");
        expect(children).toBeVisible();

        await user.click(children);

        expect(handleClose).not.toHaveBeenCalled();
    });

});