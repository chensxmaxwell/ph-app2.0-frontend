import { ScreenWrapperProps } from ".";

export const useScreenWrapper = () => {

    const getBackgroundTypeConfig = (backgroundType: ScreenWrapperProps['backgroundType']) => {
        switch (backgroundType) {
            case 'gray':
                return {
                    colors: ['#5A5972', '#252236'],
                    start: { x: 0, y: 0 },
                    end: { x: 0, y: 1 }
                }
            default:
                return {
                    colors: ['#5E5DB9', '#2A2659'],
                    start: { x: 0, y: 0 },
                    end: { x: 0, y: 1 }
                }
        }
    }

    return {
        getBackgroundTypeConfig
    };
}
