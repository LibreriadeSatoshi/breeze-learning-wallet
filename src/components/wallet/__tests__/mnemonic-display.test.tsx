import { render, screen } from "@/test/test-utils";
import { MnemonicDisplay } from "../mnemonic-display";

const words = ["word1", "word2", "word3", "word4", "word5", "word6", "word7", "word8", "word9", "word10", "word11", "word12"]

describe("MnemonicDisplay", () => {
    it("should render a mnemonic display", () => {
        render(<MnemonicDisplay words={words} />);

        words.forEach((word, index) => {
            expect(screen.getByText(word)).toBeVisible();
            expect(screen.getByText(`${index + 1}.`)).toBeVisible();
        })
    });
});