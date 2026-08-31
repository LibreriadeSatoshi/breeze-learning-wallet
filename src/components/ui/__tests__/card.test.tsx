import {render, screen} from '@testing-library/react'
import { Card, CardHeader, CardContent} from '../card'

describe("Card", () => {
    it("should render a card", () => {
        render(
            <Card>
                <CardHeader>
                    <h3>Header</h3>
                </CardHeader>
                <CardContent>
                    <p>Content</p>
                </CardContent>
            </Card>
        )

        const cardHeader = screen.getByRole("heading", { name: /header/i });
        const cardContent = screen.getByText(/content/i);
        const card = cardHeader.parentElement!;
        
        expect(card).toBeInTheDocument();
        expect(cardHeader).toBeInTheDocument();
        expect(cardContent).toBeInTheDocument();
    })
})