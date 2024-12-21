import axios from "axios";
import useAuth from "./useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const axiosSecure = axios.create(({
    baseURL: import.meta.env.VITE_API,
    withCredentials: true,
}))

const useAxiosSecure = () => {
    const { logOut } = useAuth()
    const navigate = useNavigate()
    useEffect(() => {
        axiosSecure.interceptors.response.use(res => {
            return res
        }, async (error) => {

            if (error.response.status === 401 || error.response.status === 403) {
                //  wrong user logout the application 
                logOut()
                // navigate login 
                navigate('/login')
            }
        })
    }, [logOut, navigate])
    return axiosSecure;
}

export default useAxiosSecure;