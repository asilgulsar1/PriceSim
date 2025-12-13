import { getUsers } from "@/lib/user-store";
import { addUserAction, removeUserAction } from "./actions";
import { UserMarginEditor } from "./UserMarginEditor";

export default async function AdminDashboard() {
    const users = await getUsers();

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">User Management</h1>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Add New User</h2>
                <form action={addUserAction} className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Email (Google Account)</label>
                        <input
                            name="email"
                            type="email"
                            required
                            placeholder="user@example.com"
                            className="w-full p-2 border rounded dark:bg-zinc-700 dark:border-zinc-600"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                            name="name"
                            type="text"
                            placeholder="John Doe"
                            className="w-full p-2 border rounded dark:bg-zinc-700 dark:border-zinc-600"
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-sm font-medium mb-1">Role</label>
                        <select
                            name="role"
                            className="w-full p-2 border rounded dark:bg-zinc-700 dark:border-zinc-600"
                        >
                            <option value="sales">Sales</option>
                            <option value="admin">Admin</option>
                            <option value="reseller">Reseller</option>
                        </select>
                    </div>
                    <div className="w-40">
                        <label className="block text-sm font-medium mb-1">Reseller Margin ($)</label>
                        <input
                            name="resellerMargin"
                            type="number"
                            placeholder="e.g. 500"
                            className="w-full p-2 border rounded dark:bg-zinc-700 dark:border-zinc-600"
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                    >
                        Add User
                    </button>
                </form>
                <p className="text-sm text-gray-500 mt-4">
                    👋 To invite a user, simply add their email here. Then ask them to log in at <code>admin.asic.ae</code> using that Google Account.
                </p>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
                <h2 className="text-xl font-semibold p-6 border-b dark:border-zinc-700">Authorized Users</h2>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-zinc-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                            {users.map((user) => (
                                <tr key={user.email}>
                                    <td className="px-6 py-4 whitespace-nowrap">{user.name || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                            user.role === 'reseller' ? 'bg-orange-100 text-orange-800' :
                                                'bg-green-100 text-green-800'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <UserMarginEditor
                                            email={user.email}
                                            initialMargin={user.resellerMargin || 0}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <form action={removeUserAction}>
                                            <input type="hidden" name="email" value={user.email} />
                                            <button type="submit" className="text-red-600 hover:text-red-900">Remove</button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                        No users found. (Are you running globally? Ensure Blob Env Vars are set)
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
