import React, { useState } from 'react';
import { Book, Plus, Search, Tag, Building, Home, School, Hospital, Briefcase, ShoppingCart } from 'lucide-react';

// ============================================================================
// BS 6399 BUILDING CLASSIFICATION & LOADS
// ============================================================================

const BS6399_BUILDING_CLASSES = {
    residential: {
        icon: Home,
        name: 'Residential Buildings',
        color: '#4CAF50',
        categories: {
            domestic: {
                name: 'Domestic & Residential',
                imposed_load: 1.5,
                dead_load_typical: 5.0,
                partition_allowance: 1.0,
                description: 'Dwellings, apartments, houses'
            },
            hotel_bedroom: {
                name: 'Hotel Bedrooms',
                imposed_load: 2.0,
                dead_load_typical: 5.5,
                partition_allowance: 1.0,
                description: 'Hotel and motel sleeping areas'
            },
            hotel_public: {
                name: 'Hotel Public Areas',
                imposed_load: 4.0,
                dead_load_typical: 6.0,
                partition_allowance: 1.5,
                description: 'Lobbies, corridors, dining areas'
            }
        }
    },

    office: {
        icon: Briefcase,
        name: 'Office Buildings',
        color: '#2196F3',
        categories: {
            general_office: {
                name: 'General Office Use',
                imposed_load: 2.5,
                dead_load_typical: 5.5,
                partition_allowance: 1.0,
                description: 'Office areas for general use'
            },
            filing_storage: {
                name: 'Filing & Storage',
                imposed_load: 5.0,
                dead_load_typical: 6.0,
                partition_allowance: 1.0,
                description: 'Dense filing, storage rooms'
            },
            data_center: {
                name: 'Data Centers',
                imposed_load: 7.5,
                dead_load_typical: 7.0,
                partition_allowance: 0.5,
                description: 'Computer rooms, server areas'
            }
        }
    },

    educational: {
        icon: School,
        name: 'Educational Buildings',
        color: '#FF9800',
        categories: {
            classroom: {
                name: 'Classrooms',
                imposed_load: 3.0,
                dead_load_typical: 5.5,
                partition_allowance: 1.0,
                description: 'Teaching areas, lecture rooms'
            },
            laboratory: {
                name: 'Laboratories',
                imposed_load: 3.0,
                dead_load_typical: 6.5,
                partition_allowance: 1.0,
                description: 'Science labs, workshops'
            },
            library_reading: {
                name: 'Library Reading Areas',
                imposed_load: 2.5,
                dead_load_typical: 5.5,
                partition_allowance: 1.0,
                description: 'Reading rooms, study areas'
            },
            library_stacks: {
                name: 'Library Book Stacks',
                imposed_load: 4.0,
                dead_load_typical: 6.0,
                partition_allowance: 0.5,
                description: 'Book storage, archives'
            }
        }
    },

    healthcare: {
        icon: Hospital,
        name: 'Healthcare Facilities',
        color: '#f44336',
        categories: {
            ward: {
                name: 'Hospital Wards',
                imposed_load: 2.0,
                dead_load_typical: 5.5,
                partition_allowance: 1.0,
                description: 'Patient rooms, wards'
            },
            operating_theatre: {
                name: 'Operating Theatres',
                imposed_load: 3.0,
                dead_load_typical: 7.0,
                partition_allowance: 1.0,
                description: 'Surgery rooms, critical care'
            },
            corridor: {
                name: 'Corridors',
                imposed_load: 3.0,
                dead_load_typical: 5.5,
                partition_allowance: 1.0,
                description: 'Hospital corridors, access'
            }
        }
    },

    retail: {
        icon: ShoppingCart,
        name: 'Retail & Assembly',
        color: '#9C27B0',
        categories: {
            retail_general: {
                name: 'General Retail',
                imposed_load: 4.0,
                dead_load_typical: 6.0,
                partition_allowance: 1.0,
                description: 'Shops, showrooms'
            },
            retail_storage: {
                name: 'Retail Storage',
                imposed_load: 7.5,
                dead_load_typical: 6.5,
                partition_allowance: 0.5,
                description: 'Warehouses, stockrooms'
            },
            assembly_fixed: {
                name: 'Assembly (Fixed Seating)',
                imposed_load: 4.0,
                dead_load_typical: 6.0,
                partition_allowance: 0.5,
                description: 'Theaters, cinemas'
            },
            assembly_moveable: {
                name: 'Assembly (Moveable Seating)',
                imposed_load: 5.0,
                dead_load_typical: 6.0,
                partition_allowance: 1.0,
                description: 'Halls, conference rooms'
            }
        }
    }
};

// Load reduction factors for multi-storey (BS 6399-1 Table 2)
const LOAD_REDUCTION_FACTORS = {
    1: 1.0,
    2: 0.9,
    3: 0.8,
    4: 0.7,
    5: 0.6,
    10: 0.6,
    20: 0.5
};

function getLoadReductionFactor(nFloors) {
    if (nFloors <= 1) return 1.0;
    if (nFloors <= 4) return LOAD_REDUCTION_FACTORS[nFloors];
    if (nFloors <= 10) return 0.6;
    return 0.5;
}

// ============================================================================
// BUILDING TEMPLATE LIBRARY
// ============================================================================

const BUILDING_TEMPLATES = [
    {
        id: 'office_5_storey',
        name: '5-Storey Office Building',
        category: 'office',
        subcategory: 'general_office',
        description: 'Standard office building with regular grid',
        floors: 5,
        bay_config: {
            x_bays: 4,
            y_bays: 3,
            x_spacing: 6.0,
            y_spacing: 6.0,
            floor_height: 3.5
        },
        structural_system: 'frame',
        thumbnail: '🏢'
    },
    {
        id: 'residential_3_storey',
        name: '3-Storey Apartment Block',
        category: 'residential',
        subcategory: 'domestic',
        description: 'Low-rise residential building',
        floors: 3,
        bay_config: {
            x_bays: 3,
            y_bays: 2,
            x_spacing: 5.0,
            y_spacing: 5.0,
            floor_height: 3.0
        },
        structural_system: 'wall_frame',
        thumbnail: '🏘️'
    },
    {
        id: 'school_2_storey',
        name: '2-Storey School Building',
        category: 'educational',
        subcategory: 'classroom',
        description: 'Educational facility with classrooms',
        floors: 2,
        bay_config: {
            x_bays: 6,
            y_bays: 2,
            x_spacing: 8.0,
            y_spacing: 7.0,
            floor_height: 3.5
        },
        structural_system: 'frame',
        thumbnail: '🏫'
    },
    {
        id: 'retail_1_storey',
        name: 'Single-Storey Retail',
        category: 'retail',
        subcategory: 'retail_general',
        description: 'Shopping center or showroom',
        floors: 1,
        bay_config: {
            x_bays: 5,
            y_bays: 4,
            x_spacing: 7.5,
            y_spacing: 7.5,
            floor_height: 4.5
        },
        structural_system: 'frame',
        thumbnail: '🏬'
    }
];

// ============================================================================
// LIBRARY BROWSER COMPONENT
// ============================================================================

const BuildingLibraryBrowser = ({ onSelectTemplate, onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTemplates = BUILDING_TEMPLATES.filter(template => {
        const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !selectedCategory || template.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        }}>
            <div style={{
                background: '#fff',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '1200px',
                height: '80vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px',
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Book size={28} color="#2196F3" />
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                Building Template Library
                            </div>
                            <div style={{ fontSize: '13px', color: '#666' }}>
                                Pre-configured buildings with BS 6399 loads
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            padding: '8px',
                            color: '#666'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Search and filters */}
                <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#999' }} />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 10px 10px 40px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                    </div>

                    {/* Category filters */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setSelectedCategory(null)}
                            style={{
                                padding: '8px 16px',
                                background: selectedCategory === null ? '#2196F3' : '#f5f5f5',
                                color: selectedCategory === null ? '#fff' : '#333',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500'
                            }}
                        >
                            All Categories
                        </button>
                        {Object.entries(BS6399_BUILDING_CLASSES).map(([key, cat]) => {
                            const Icon = cat.icon;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedCategory(key)}
                                    style={{
                                        padding: '8px 16px',
                                        background: selectedCategory === key ? cat.color : '#f5f5f5',
                                        color: selectedCategory === key ? '#fff' : '#333',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Icon size={16} />
                                    {cat.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Templates grid */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '20px',
                    alignContent: 'start'
                }}>
                    {filteredTemplates.map(template => {
                        const category = BS6399_BUILDING_CLASSES[template.category];
                        const subcategory = category.categories[template.subcategory];

                        return (
                            <div
                                key={template.id}
                                onClick={() => onSelectTemplate(template)}
                                style={{
                                    background: '#fff',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    ':hover': {
                                        borderColor: category.color,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = category.color;
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#e0e0e0';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div style={{ fontSize: '48px', marginBottom: '12px', textAlign: 'center' }}>
                                    {template.thumbnail}
                                </div>

                                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                                    {template.name}
                                </div>

                                <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', lineHeight: '1.4' }}>
                                    {template.description}
                                </div>

                                <div style={{
                                    padding: '8px 12px',
                                    background: `${category.color}15`,
                                    borderRadius: '6px',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ fontSize: '11px', color: category.color, fontWeight: 'bold', marginBottom: '4px' }}>
                                        {category.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        {subcategory.name}
                                    </div>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '8px',
                                    fontSize: '11px',
                                    color: '#666'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#333' }}>Floors</div>
                                        <div>{template.floors}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#333' }}>Grid</div>
                                        <div>{template.bay_config.x_bays}×{template.bay_config.y_bays}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#333' }}>Imposed</div>
                                        <div>{subcategory.imposed_load} kN/m²</div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#333' }}>Dead</div>
                                        <div>{subcategory.dead_load_typical} kN/m²</div>
                                    </div>
                                </div>

                                <button
                                    style={{
                                        width: '100%',
                                        marginTop: '12px',
                                        padding: '10px',
                                        background: category.color,
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Plus size={16} />
                                    Use Template
                                </button>
                            </div>
                        );
                    })}

                    {filteredTemplates.length === 0 && (
                        <div style={{
                            gridColumn: '1 / -1',
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: '#999'
                        }}>
                            <Search size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                            <div style={{ fontSize: '16px', marginBottom: '8px' }}>No templates found</div>
                            <div style={{ fontSize: '13px' }}>Try adjusting your search or filters</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// LOAD ASSIGNMENT PANEL
// ============================================================================

const LoadAssignmentPanel = ({ element, onAssignLoads, onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState('office');
    const [selectedSubcategory, setSelectedSubcategory] = useState('general_office');
    const [customLoads, setCustomLoads] = useState(false);

    const category = BS6399_BUILDING_CLASSES[selectedCategory];
    const subcategory = category?.categories[selectedSubcategory];

    const handleAssign = () => {
        const loads = {
            imposed: customLoads ? parseFloat(document.getElementById('custom-imposed').value) : subcategory.imposed_load,
            dead: customLoads ? parseFloat(document.getElementById('custom-dead').value) : subcategory.dead_load_typical,
            partition: customLoads ? parseFloat(document.getElementById('custom-partition').value) : subcategory.partition_allowance,
            category: selectedCategory,
            subcategory: selectedSubcategory,
            description: subcategory.description
        };

        onAssignLoads(element, loads);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                background: '#fff',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            Assign Loads - {element?.id}
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                            Select building category or enter custom loads
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            padding: '8px'
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ padding: '24px' }}>
                    {/* Category selection */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
                            Building Category
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            {Object.entries(BS6399_BUILDING_CLASSES).map(([key, cat]) => {
                                const Icon = cat.icon;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setSelectedCategory(key);
                                            setSelectedSubcategory(Object.keys(cat.categories)[0]);
                                        }}
                                        style={{
                                            padding: '12px',
                                            background: selectedCategory === key ? `${cat.color}15` : '#f5f5f5',
                                            border: `2px solid ${selectedCategory === key ? cat.color : 'transparent'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Icon size={20} color={cat.color} />
                                        <div style={{ textAlign: 'left' }}>
                                            <div>{cat.name.split(' ')[0]}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>
                                                {cat.name.split(' ').slice(1).join(' ')}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Subcategory selection */}
                    {category && (
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
                                Specific Use
                            </div>
                            <select
                                value={selectedSubcategory}
                                onChange={(e) => setSelectedSubcategory(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            >
                                {Object.entries(category.categories).map(([key, subcat]) => (
                                    <option key={key} value={key}>
                                        {subcat.name} - {subcat.description}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Load values */}
                    {subcategory && (
                        <div style={{
                            padding: '16px',
                            background: '#f9f9f9',
                            borderRadius: '8px',
                            marginBottom: '20px'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px'
                            }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                    Load Values (kN/m²)
                                </div>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={customLoads}
                                        onChange={(e) => setCustomLoads(e.target.checked)}
                                    />
                                    Custom
                                </label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                                        Imposed Load
                                    </div>
                                    {customLoads ? (
                                        <input
                                            id="custom-imposed"
                                            type="number"
                                            step="0.1"
                                            defaultValue={subcategory.imposed_load}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                fontSize: '13px'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            color: '#2196F3'
                                        }}>
                                            {subcategory.imposed_load}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                                        Dead Load
                                    </div>
                                    {customLoads ? (
                                        <input
                                            id="custom-dead"
                                            type="number"
                                            step="0.1"
                                            defaultValue={subcategory.dead_load_typical}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                fontSize: '13px'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            color: '#4CAF50'
                                        }}>
                                            {subcategory.dead_load_typical}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                                        Partitions
                                    </div>
                                    {customLoads ? (
                                        <input
                                            id="custom-partition"
                                            type="number"
                                            step="0.1"
                                            defaultValue={subcategory.partition_allowance}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                fontSize: '13px'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            color: '#FF9800'
                                        }}>
                                            {subcategory.partition_allowance}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                marginTop: '12px',
                                padding: '12px',
                                background: '#fff',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#666'
                            }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Note:</div>
                                {subcategory.description}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: '#f5f5f5',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAssign}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: category?.color || '#2196F3',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600'
                            }}
                        >
                            Assign Loads
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export {
    BuildingLibraryBrowser,
    LoadAssignmentPanel,
    BS6399_BUILDING_CLASSES,
    BUILDING_TEMPLATES,
    getLoadReductionFactor
};