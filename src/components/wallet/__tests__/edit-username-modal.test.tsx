import { act, renderWithProviders, screen, waitFor, within } from "@/test/test-utils";
import userEvent from '@testing-library/user-event'
import { EditUsernameModal } from "../edit-username-modal";
import { useLightningAddress } from "@/hooks/use-breez";

const onClose = vi.fn();
const save = vi.fn();

const EditUsernameModalWithState = () => {
    const { data: lnAddress, isLoading, refetch } = useLightningAddress(true);

    if(lnAddress === undefined || lnAddress === null) return

    return (
        <EditUsernameModal currentAddress={lnAddress.lightningAddress} onClose={onClose} onChanged={() => save()} />
    )
}

describe("EditUsernameModal", () => {
    it("should render the modal with one input", async () => {
        renderWithProviders(<EditUsernameModalWithState />);

        const modalElement = await screen.findByRole("dialog"); 

        const title = within(modalElement).getByRole('heading', { name: /edit lightning address/i })
        const description = within(modalElement).getByText(/satoshi@pay\.santiagobitdevs\.org\./i)
        const input = within(modalElement).getByRole("textbox", { name: /username/i });
        
        expect(title).toBeVisible();
        expect(description).toBeVisible();
        expect(input).toBeVisible();
    });

    it("should type in the input", async () => {
        const user = userEvent.setup();
        renderWithProviders(<EditUsernameModalWithState />);

        const input = await screen.findByRole("textbox", { name: /username/i });
        await user.clear(input);
        await user.type(input, "test2");
        
        expect(input).toHaveValue("test2");
    });
    it("should disable the replace button when the username exists", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(<EditUsernameModalWithState />);

    const input = await screen.findByRole("textbox", { name: /username/i });
    await user.clear(input);
    await user.type(input, "dorchestra");

    act(() => {
        vi.advanceTimersByTimeAsync(850);
    })

    waitFor(() => {
        expect(screen.getByText(/taken/i)).toBeVisible();
    })

    const replaceButton = screen.getByRole("button", { name: /replace/i });
    expect(replaceButton).toBeDisabled();

    vi.useRealTimers();
});
    it("test the replace button", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        
        renderWithProviders(<EditUsernameModalWithState />);

        const input = await screen.findByRole("textbox", { name: /username/i });
        
        await user.clear(input);
        await user.type(input, "tester");
        
        await vi.advanceTimersByTimeAsync(350);

        const replaceButton = screen.getByRole("button", { name: /replace/i });
        expect(replaceButton).not.toBeDisabled();

        await user.click(replaceButton);

        await waitFor(() => {
            expect(save).toHaveBeenCalled();
        });

        vi.useRealTimers();
    });
    it("should close the modal when clicking on the backdrop or the cancel button", async () => {
        const user = userEvent.setup();
        const {rerender} =renderWithProviders(<EditUsernameModalWithState />);

        const cancelButton = await screen.findByRole("button", { name: /cancel/i });
        await user.click(cancelButton);
        
        await waitFor(() => {
            expect(onClose).toHaveBeenCalled();
        });

        rerender(<EditUsernameModalWithState />);

        const backdrop = (await screen.findByRole("dialog")).parentElement!;
        await user.click(backdrop);
        
        await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(2);
        });
    })
});