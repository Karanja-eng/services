/**
 * Local CAD Storage Service
 * Handles project and object management for CadDrawer without backend dependencies.
 */

const STORAGE_KEY = 'cad_projects';

export const cadStorageService = {
    // Get all projects
    getProjects: () => {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    },

    // Save project
    saveProject: (projectId, projectData) => {
        const projects = cadStorageService.getProjects();
        projects[projectId] = {
            ...projects[projectId],
            ...projectData,
            modifiedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    },

    // Get specific project
    getProject: (projectId) => {
        const projects = cadStorageService.getProjects();
        return projects[projectId] || null;
    },

    // Delete project
    deleteProject: (projectId) => {
        const projects = cadStorageService.getProjects();
        delete projects[projectId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    },

    // Save objects to a project
    saveObjects: (projectId, objects) => {
        const project = cadStorageService.getProject(projectId) || { id: projectId, name: 'Untitled Project' };
        project.objects = objects;
        cadStorageService.saveProject(projectId, project);
    },

    // Get objects for a project
    getObjects: (projectId) => {
        const project = cadStorageService.getProject(projectId);
        return project ? project.objects || [] : [];
    }
};
