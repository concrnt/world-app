import { AnimatePresence, motion } from "motion/react";
import { Activity, createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

interface Props {
    children: ReactNode;
}

interface StackLayoutContextState {
    push: (child: ReactNode) => void;
    pop: () => void;
}

const StackLayoutContext = createContext<StackLayoutContextState>({
    push: () => { },
    pop: () => { },
});

export const StackLayout = (props: Props) => {

    const [stack, setStack] = useState<ReactNode[]>([]);

    const push = useCallback((child: ReactNode) => {
        setStack((prev) => [...prev, child]);
    }, []);

    const pop = useCallback(() => {
        setStack((prev) => {
            const newStack = [...prev];
            newStack.pop();
            return newStack;
        });
    }, []);

    const value = useMemo(() => ({
        push,
        pop,
    }), [push, pop]);

    return <StackLayoutContext.Provider value={value}>
        <div
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
            }}
        >

            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                }}
            >
                {props.children}
            </div>

            <AnimatePresence>
            {stack.map((child, index) => (
                <Activity
                    key={index}
                    mode={index === stack.length - 1 ? 'visible' : 'hidden'}
                >
                    <motion.div
                        style={{
                            position: 'absolute',
                            top: 0,
                            //left: 0,
                            width: '100%',
                            height: '100%'
                        }}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ duration: 0.1 }}
                    >
                        {child}
                    </motion.div>
                </Activity>
            ))}
            </AnimatePresence>

        </div>
    </StackLayoutContext.Provider>;
}

export const useStack = () => {
    return useContext(StackLayoutContext);
}

