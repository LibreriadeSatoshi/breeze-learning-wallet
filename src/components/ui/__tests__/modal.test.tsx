import { Modal } from "../modal";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const handleClose = vi.fn();
const modal_children = <p>test children</p>;

describe("Modal", () => {
    it("should render a full modal", async () => {
        render(<Modal open={true} onClose={handleClose} title="test" description="lorem ipsum dolor">{modal_children}</Modal>);

        const modal = screen.getByRole("dialog", { name: /test/i });
        const children = screen.getByText(/test children/i);

        expect(modal).toHaveAttribute("aria-modal", "true");
        expect(modal).toHaveAccessibleDescription("lorem ipsum dolor");
        expect(children).toBeVisible();
    });

    it("show a modal without description", async () => {
        render(<Modal open={true} onClose={handleClose} title="test">{modal_children}</Modal>);

        const modal = screen.getByRole("dialog", { name: /test/i });

        expect(modal).not.toHaveAccessibleDescription();
    });

    it("should close the modal when clicking on the backdrop", async () => {
        const user = userEvent.setup();

        render(
            <Modal open={true} onClose={handleClose} title="test">
                {modal_children}
            </Modal>
        );

        const modal = screen.getByRole("dialog", { name: /test/i });
        const backdrop = modal.parentElement!;

        await user.click(backdrop);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("should close the modal when keyboard escape is pressed", async () => {
        const user = userEvent.setup();

        render(
            <Modal open={true} onClose={handleClose} title="test">
                {modal_children}
            </Modal>
        );

        await user.keyboard("[Escape]");

        expect(handleClose).toHaveBeenCalledTimes(1);
    });
    
    it("should not close the modal when clicking inside the modal content", async () => {
        const user = userEvent.setup();
        render(
            <Modal open={true} onClose={handleClose} title="test">
                {modal_children}
            </Modal>
        );

        const children = screen.getByText(/test children/i);

        await user.click(children);

        expect(handleClose).not.toHaveBeenCalled();
    });

});