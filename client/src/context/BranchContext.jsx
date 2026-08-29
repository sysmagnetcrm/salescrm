import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const BranchContext = createContext();

export const BranchProvider = ({ children }) => {
    const { user } = useAuth();
    const [branch, setBranch] = useState(user?.branch || localStorage.getItem('admin_branch') || '');

    useEffect(() => {
        if (user) {
            if (user.role !== 'admin') {
                setBranch(user.branch || '');
            } else if (!branch && user.branch) {
                setBranch(user.branch);
            }
        }
    }, [user]);

    const switchBranch = (newBranch) => {
        setBranch(newBranch);
        if (newBranch) {
            localStorage.setItem('admin_branch', newBranch);
        } else {
            localStorage.removeItem('admin_branch');
        }
    };

    return (
        <BranchContext.Provider value={{ branch, switchBranch }}>
            {children}
        </BranchContext.Provider>
    );
};

export const useBranch = () => useContext(BranchContext);
