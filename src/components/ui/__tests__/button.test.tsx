import { Button } from "../button"
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe("Button", () => {
    it("should render a button", async () => { 
        const user = userEvent.setup();
        const handleClick = vi.fn();

        render(<Button onClick={handleClick}>test</Button>)

        const button = screen.getByRole("button", { name: /test/i })
        await user.click(button)

        expect(handleClick).toHaveBeenCalledTimes(1)
    })
    it("show a loading text and disable the button", async () => { 
        const user = userEvent.setup();
        const handleClick = vi.fn()

        render(<Button loading={true} onClick={handleClick}>test</Button>)

        const button = screen.getByRole("button", { name: /loading.../i })

        expect(button).toBeDisabled()
        expect(screen.queryByText("test")).not.toBeInTheDocument()
        
        await user.click(button)

        expect(handleClick).not.toHaveBeenCalled()
    })
    it("should disable the button", async () => { 
        const user = userEvent.setup();
        const handleClick = vi.fn()

        render(<Button disabled={true} onClick={handleClick}>test</Button>)

        const button = screen.getByRole("button", { name: /test/i })
        
        await user.click(button)

        expect(handleClick).not.toHaveBeenCalled()
        expect(button).toBeDisabled()
    })
})