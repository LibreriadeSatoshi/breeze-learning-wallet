import {render, screen} from '@testing-library/react';
import { LanguagePickerSection } from '../language-picker';
import userEvent from '@testing-library/user-event';
import { LOCALES } from "@/lib/i18n/types";

const mockedSetLocale = vi.fn();

vi.mock("@/lib/i18n/hook", () => ({
    useLocale: () => ({
        locale: "en",
        setLocale: mockedSetLocale
    })
}))
describe("LanguagePickerSection", () => {
    it("should render a language picker", async () => {
        const user = userEvent.setup();

        render(<LanguagePickerSection />)

        const languagePicker = screen.getByRole("combobox");
        
        expect(languagePicker).toHaveValue("en");

        await user.selectOptions(languagePicker, "es");

        expect(mockedSetLocale).toHaveBeenCalledWith("es");  ;
    })
    it("should render all available languages", async () => {
        render(<LanguagePickerSection />)

        const languagePicker = screen.getByRole("combobox");

        expect(languagePicker).toHaveValue("en");
        expect(screen.getAllByRole("option")).toHaveLength(LOCALES.length);
    })
    it("show correct native name for each language", async () => {
        render(<LanguagePickerSection />)

        expect(screen.getByRole("option", { name: /español/i })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: /english/i })).toBeInTheDocument();
    })
})